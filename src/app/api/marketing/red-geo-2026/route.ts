import { NextRequest, NextResponse } from 'next/server';
import { amoFetchJson } from '@/lib/amo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RE_PIPELINE_ID = 8696950;
const SOURCE_FIELD_ID = 703131;

const RED_TAGS = ['RED_RU', 'RED_ENG', 'RED_ARM', 'RED_LUX'] as const;
const RED_TAG_SET = new Set(RED_TAGS);

type Lead = {
  id: number;
  custom_fields_values?: Array<any>;
  _embedded?: {
    tags?: Array<{ name?: string }>;
    contacts?: Array<{ id: number; is_main?: boolean }>;
  };
};

type GeoItem = { label: string; leads: number };

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits;
}

function inferCountry(phoneDigits: string): string {
  if (!phoneDigits) return 'Unknown';
  if (phoneDigits.startsWith('971')) return 'UAE';
  if (phoneDigits.startsWith('374')) return 'Armenia';
  if (phoneDigits.startsWith('7')) return 'CIS (+7)';
  if (phoneDigits.startsWith('44')) return 'UK';
  if (phoneDigits.startsWith('1')) return 'US/CA';
  if (phoneDigits.startsWith('91')) return 'India';
  if (phoneDigits.startsWith('90')) return 'Turkey';
  if (phoneDigits.startsWith('994')) return 'Azerbaijan';
  if (phoneDigits.startsWith('998')) return 'Uzbekistan';
  if (phoneDigits.startsWith('995')) return 'Georgia';
  if (phoneDigits.startsWith('380')) return 'Ukraine';
  if (phoneDigits.startsWith('373')) return 'Moldova';
  if (phoneDigits.startsWith('371')) return 'Latvia';
  if (phoneDigits.startsWith('372')) return 'Estonia';
  return 'Other';
}

function inferPhoneCode(phoneDigits: string): string {
  if (!phoneDigits) return 'Unknown';
  const known = ['971', '374', '994', '998', '995', '380', '373', '371', '372', '44', '91', '90', '7', '1'];
  for (const code of known) {
    if (phoneDigits.startsWith(code)) return `+${code}`;
  }
  return `+${phoneDigits.slice(0, 3)}`;
}

function extractSourceValue(lead: Lead): string {
  const source = (lead.custom_fields_values || []).find((f: any) => f.field_id === SOURCE_FIELD_ID)?.values?.[0]?.value;
  return String(source || '').toUpperCase().trim();
}

function hasRedTagOrSource(lead: Lead): boolean {
  const tags = (lead._embedded?.tags || []).map((t) => String(t.name || '').toUpperCase().trim());
  const sourceValue = extractSourceValue(lead);
  return tags.some((tag) => RED_TAG_SET.has(tag as any)) || RED_TAG_SET.has(sourceValue as any);
}

async function fetchAllRedLeads(startTs: number, endTs: number): Promise<Lead[]> {
  const allLeads: Lead[] = [];
  let page = 1;

  while (true) {
    const url =
      `/api/v4/leads?filter[pipeline_id]=${RE_PIPELINE_ID}` +
      `&filter[created_at][from]=${startTs}&filter[created_at][to]=${endTs}` +
      `&limit=250&page=${page}&with=tags,contacts`;

    const data = await amoFetchJson<{ _embedded?: { leads?: Lead[] } }>(url);
    const leads = data._embedded?.leads || [];
    if (!leads.length) break;

    allLeads.push(...leads);
    if (leads.length < 250) break;
    page += 1;
  }

  return allLeads.filter(hasRedTagOrSource);
}

function extractContactPhone(contact: any): string {
  const fields = contact?.custom_fields_values || [];
  for (const field of fields) {
    const code = String(field.field_code || '').toUpperCase();
    const name = String(field.field_name || '').toLowerCase();
    if (code !== 'PHONE' && !name.includes('phone') && !name.includes('тел')) continue;
    const value = String(field.values?.[0]?.value || '').trim();
    if (value) return value;
  }
  return '';
}

async function fetchContactsPhoneMap(contactIds: number[]): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (!contactIds.length) return result;

  const chunkSize = 100;
  for (let i = 0; i < contactIds.length; i += chunkSize) {
    const chunk = contactIds.slice(i, i + chunkSize);
    const params = new URLSearchParams();
    params.set('limit', '250');
    for (const id of chunk) params.append('filter[id][]', String(id));

    const url = `/api/v4/contacts?${params.toString()}`;
    const data = await amoFetchJson<{ _embedded?: { contacts?: any[] } }>(url);
    const contacts = data._embedded?.contacts || [];

    for (const c of contacts) {
      const rawPhone = extractContactPhone(c);
      if (!rawPhone) continue;
      result.set(Number(c.id), normalizePhone(rawPhone));
    }
  }

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = req.nextUrl.searchParams;
    const startDate = params.get('startDate') || '2026-01-01';
    const endDate = params.get('endDate') || new Date().toISOString().slice(0, 10);

    const startTs = Math.floor(new Date(`${startDate}T00:00:00.000Z`).getTime() / 1000);
    const endTs = Math.floor(new Date(`${endDate}T23:59:59.000Z`).getTime() / 1000);

    const leads = await fetchAllRedLeads(startTs, endTs);

    const contactIds = Array.from(new Set(
      leads
        .map((lead) => {
          const contacts = lead._embedded?.contacts || [];
          const main = contacts.find((c) => c.is_main);
          return Number(main?.id || contacts[0]?.id || 0);
        })
        .filter((id) => id > 0),
    ));

    const phonesByContactId = await fetchContactsPhoneMap(contactIds);

    const countries = new Map<string, number>();
    const phoneCodes = new Map<string, number>();

    for (const lead of leads) {
      const contacts = lead._embedded?.contacts || [];
      const main = contacts.find((c) => c.is_main);
      const contactId = Number(main?.id || contacts[0]?.id || 0);
      const phoneDigits = phonesByContactId.get(contactId) || '';

      const countryCategory = `Country: ${inferCountry(phoneDigits)}`;
      const phoneCategory = `Phone code: ${inferPhoneCode(phoneDigits)}`;

      countries.set(countryCategory, (countries.get(countryCategory) || 0) + 1);
      phoneCodes.set(phoneCategory, (phoneCodes.get(phoneCategory) || 0) + 1);
    }

    const toSortedItems = (input: Map<string, number>): GeoItem[] => (
      Array.from(input.entries())
        .map(([label, count]) => ({ label, leads: count }))
        .sort((a, b) => b.leads - a.leads)
    );

    const countriesRows = toSortedItems(countries);
    const phoneRows = toSortedItems(phoneCodes);

    return NextResponse.json({
      success: true,
      data: {
        totalRedLeads: leads.length,
        countries: countriesRows,
        phoneCodes: phoneRows,
      },
      meta: { startDate, endDate, countries: countriesRows.length, phoneCodes: phoneRows.length },
    });
  } catch (err) {
    console.error('[red-geo-2026] error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
