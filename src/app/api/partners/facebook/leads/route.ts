import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { amoFetch } from '@/lib/amo';

type AmoLead = {
  id: number;
  name: string;
  price: number;
  status_id: number;
  created_at: number;
  responsible_user_id: number;
  custom_fields_values?: Array<{
    field_code?: string;
    field_name?: string;
    values?: Array<{ value?: string | number }>;
  }>;
  _embedded?: {
    tags?: Array<{ name?: string }>;
    contacts?: Array<{
      id?: number;
      is_main?: boolean;
      custom_fields_values?: Array<{
        field_code?: string;
        field_name?: string;
        values?: Array<{ value?: string | number }>;
      }>;
    }>;
  };
};

const RE_PIPELINE_ID = '8696950';
const CACHE_PATH = path.resolve(process.cwd(), 'data/cache/partners/facebook_leads.json');
const FALLBACK_CACHE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

async function readCache() {
  try {
    return JSON.parse(await fs.readFile(CACHE_PATH, 'utf8')) as {
      data: any[];
      funnels: Array<{ id: number; name: string }>;
      cachedAt: string;
    };
  } catch {
    return null;
  }
}

async function writeCache(data: any[], funnels: Array<{ id: number; name: string }>) {
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await fs.writeFile(
    CACHE_PATH,
    JSON.stringify({ data, funnels, cachedAt: new Date().toISOString() }),
    'utf8',
  );
}

function hasRecentCache(cachedAt?: string) {
  if (!cachedAt) return false;
  const timestamp = Date.parse(cachedAt);
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= FALLBACK_CACHE_MAX_AGE_MS;
}

function isFacebookOmanLead(lead: AmoLead) {
  const tags = (lead._embedded?.tags || []).map((t) => (t.name || '').toLowerCase());
  return tags.includes('oman');
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

function extractLeadPhone(lead: AmoLead) {
  const ownPhone = extractPhoneFromCustomFields(lead.custom_fields_values);
  if (ownPhone) return ownPhone;

  const contacts = lead._embedded?.contacts || [];
  const mainContact = contacts.find((c) => c.is_main);
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
    const limit = 250;
    let page = 1;
    let hasMore = true;
    const allLeads: AmoLead[] = [];

    // Use query=Oman for efficient server-side filtering (much faster than fetching all leads)
    while (hasMore) {
      const url =
        `/api/v4/leads?filter[pipeline_id]=${RE_PIPELINE_ID}` +
        `&query=Oman` +
        `&limit=${limit}&page=${page}&with=contacts,tags`;

      const res = await amoFetch(url);
      if (res.status === 204) break;
      if (!res.ok) {
        const err = await res.text();
        const cached = await readCache();
        if (res.status === 401 && cached?.data?.length && hasRecentCache(cached.cachedAt)) {
          return NextResponse.json({
            success: true,
            stale: true,
            fallback: 'recent-cache',
            cachedAt: cached.cachedAt,
            data: cached.data,
            funnels: cached.funnels || [],
          });
        }
        if (cached?.data?.length) {
          return NextResponse.json({
            success: true,
            stale: true,
            cachedAt: cached.cachedAt,
            data: cached.data,
            funnels: cached.funnels || [],
          });
        }
        return NextResponse.json({ success: false, error: err }, { status: res.status });
      }

      const json = await res.json();
      const leadsPage: AmoLead[] = json._embedded?.leads || [];
      if (!leadsPage.length) break;

      allLeads.push(...leadsPage);
      hasMore = leadsPage.length === limit;
      page += 1;
    }

    const filtered = allLeads.filter(isFacebookOmanLead);

    const contactIds = filtered
      .flatMap((l) => (l._embedded?.contacts || []).map((contact) => Number(contact.id)))
      .filter((id) => Number.isFinite(id));
    const phoneByContactId = await fetchContactsPhoneMap(contactIds);

    const mapped = filtered.map((l) => {
        const tags = (l._embedded?.tags || []).map((t) => t.name || '').filter(Boolean);
        // If query found it, but tags in response are empty, it might still be a valid Oman lead
        if (tags.length === 0) tags.push('Oman');

        const mainContactId = Number((l._embedded?.contacts || []).find((c) => c.is_main)?.id);
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
            tags: tags,
        };
    });

    // Fetch pipeline statuses for dynamic columns
    const pipelineRes = await amoFetch(`/api/v4/leads/pipelines/${RE_PIPELINE_ID}`);
    let funnels: Array<{ id: number; name: string }> = [];
    if (pipelineRes.ok) {
      const pipeline = await pipelineRes.json();
      const statuses = pipeline?._embedded?.statuses || [];
      funnels = statuses
        .map((s: any) => ({ id: Number(s.id), name: String(s.name || '') }))
        .filter((s: any) => Number.isFinite(s.id) && s.name);
    }

      await writeCache(mapped, funnels);

    return NextResponse.json({
      success: true,
      data: mapped,
      funnels
    });
  } catch (e: any) {
    const cached = await readCache();
    if (cached?.data?.length && hasRecentCache(cached.cachedAt)) {
      return NextResponse.json({
        success: true,
        stale: true,
        fallback: 'recent-cache',
        cachedAt: cached.cachedAt,
        data: cached.data,
        funnels: cached.funnels || [],
      });
    }
    if (cached?.data?.length) {
      return NextResponse.json({
        success: true,
        stale: true,
        cachedAt: cached.cachedAt,
        data: cached.data,
        funnels: cached.funnels || [],
      });
    }
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
