
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { amoFetch } from '@/lib/amo';

const CACHE_PATH = path.resolve(process.cwd(), 'data/cache/partners/klykov_leads.json');
const FALLBACK_CACHE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

async function readCache() {
  try {
    return JSON.parse(await fs.readFile(CACHE_PATH, 'utf8')) as { data: any[]; cachedAt: string };
  } catch {
    return null;
  }
}

async function writeCache(data: any[]) {
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await fs.writeFile(
    CACHE_PATH,
    JSON.stringify({ data, cachedAt: new Date().toISOString() }),
    'utf8',
  );
}

function hasRecentCache(cachedAt?: string) {
  if (!cachedAt) return false;
  const timestamp = Date.parse(cachedAt);
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= FALLBACK_CACHE_MAX_AGE_MS;
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function extractPhoneFromCustomFields(
  customFields?: Array<{
    field_code?: string;
    field_name?: string;
    values?: Array<{ value?: string | number }>;
  }>,
) {
  if (!customFields?.length) return null;

  for (const field of customFields) {
    const code = (field.field_code || '').toUpperCase();
    const name = (field.field_name || '').toLowerCase();
    const isPhoneField = code === 'PHONE' || name.includes('телефон') || name.includes('phone');
    if (!isPhoneField) continue;

    for (const entry of field.values || []) {
      const raw = String(entry?.value || '').trim();
      if (raw) return raw;
    }
  }

  return null;
}

function extractLeadPhone(lead: any) {
  const ownPhone = extractPhoneFromCustomFields(lead.custom_fields_values);
  if (ownPhone) return ownPhone;

  const contacts = lead._embedded?.contacts || [];
  const mainContact = contacts.find((c: any) => c.is_main);
  if (mainContact) {
    const mainPhone = extractPhoneFromCustomFields(mainContact.custom_fields_values);
    if (mainPhone) return mainPhone;
  }

  for (const contact of contacts) {
    const phone = extractPhoneFromCustomFields(contact.custom_fields_values);
    if (phone) return phone;
  }

  return null;
}

async function fetchContactsPhoneMap(contactIds: number[]) {
  const phoneByContactId = new Map<number, string>();
  if (!contactIds.length) return phoneByContactId;

  const uniqueIds = Array.from(new Set(contactIds));
  const chunks = chunkArray(uniqueIds, 100);

  for (const chunk of chunks) {
    const idsQuery = chunk.map((id) => `filter[id][]=${id}`).join('&');
    const query = `/api/v4/contacts?limit=250&${idsQuery}`;
    const res = await amoFetch(query);
    if (!res.ok) continue;

    const payload = await res.json();
    const contacts = payload?._embedded?.contacts || [];
    for (const contact of contacts) {
      const phone = extractPhoneFromCustomFields(contact.custom_fields_values);
      if (phone && Number.isFinite(contact.id)) {
        phoneByContactId.set(Number(contact.id), phone);
      }
    }
  }

  return phoneByContactId;
}

export async function GET() {
  try {
    const pipelineId = '10776450';
    const query = `/api/v4/leads?filter[pipeline_id]=${pipelineId}&limit=250&with=contacts`;
    
    console.log('[Partners/Klykov/Leads] Fetching from AMO pipeline:', pipelineId);
    const res = await amoFetch(query);

    if (!res.ok) {
        const err = await res.text();
        console.error('[Partners/Klykov/Leads] AMO returned error:', {
          status: res.status,
          statusText: res.statusText,
          errorLength: err.length,
        });
        const cached = await readCache();
        if (res.status === 401 && cached?.data?.length && hasRecentCache(cached.cachedAt)) {
          return NextResponse.json({
            success: true,
            stale: true,
            fallback: 'recent-cache',
            cachedAt: cached.cachedAt,
            data: cached.data,
          });
        }
        if (cached?.data?.length) {
          return NextResponse.json({ success: true, stale: true, cachedAt: cached.cachedAt, data: cached.data });
        }
        return NextResponse.json({ success: false, error: err }, { status: res.status });
    }

    const json = await res.json();
    const leads = json._embedded?.leads || [];
    
    console.log('[Partners/Klykov/Leads] Successfully fetched', leads.length, 'leads');

    const contactIds = leads
      .flatMap((l: any) => (l._embedded?.contacts || []).map((contact: any) => Number(contact.id)))
      .filter((id: number) => Number.isFinite(id));
    const phoneByContactId = await fetchContactsPhoneMap(contactIds);

    const mapped = leads.map((l: any) => {
      const mainContactId = Number((l._embedded?.contacts || []).find((c: any) => c.is_main)?.id);
      const firstContactId = Number((l._embedded?.contacts || [])[0]?.id);
      const phoneFromContacts =
        (Number.isFinite(mainContactId) && phoneByContactId.get(mainContactId)) ||
        (Number.isFinite(firstContactId) && phoneByContactId.get(firstContactId)) ||
        null;

      return {
        id: l.id,
        name: l.name,
        price: l.price,
        status_id: l.status_id,
        created_at: l.created_at,
        responsible_user_id: l.responsible_user_id,
        phone: extractLeadPhone(l) || phoneFromContacts,
        tags: l._embedded?.tags?.map((t: any) => t.name) || []
      };
    });

    await writeCache(mapped);

    return NextResponse.json({ success: true, data: mapped });
  } catch (e: any) {
    console.error('[Partners/Klykov/Leads] Exception:', e.message);
    const cached = await readCache();
    if (cached?.data?.length && hasRecentCache(cached.cachedAt)) {
      return NextResponse.json({
        success: true,
        stale: true,
        fallback: 'recent-cache',
        cachedAt: cached.cachedAt,
        data: cached.data,
      });
    }
    if (cached?.data?.length) {
      return NextResponse.json({ success: true, stale: true, cachedAt: cached.cachedAt, data: cached.data });
    }
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
