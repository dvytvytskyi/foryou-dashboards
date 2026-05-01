/**
 * Matches PF Primary Plus leads (entityType=project from PF API)
 * with AMO CRM leads tagged "pf offplan" by phone number.
 *
 * Output: data/cache/pf_amo_project_match.json
 * Shape:  { [projectId]: { crm_leads: N, crm_leads_by_month: { "2026-01": N } } }
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const PF_API_URL = 'https://atlas.propertyfinder.com/v1';
const AMO_DOMAIN = process.env.AMO_DOMAIN || 'reforyou.amocrm.ru';
const TOKENS_FILE = path.resolve(ROOT, 'secrets/amo_tokens.json');
const OUT_FILE = path.resolve(ROOT, 'data/cache/pf_amo_project_match.json');

const PF_OFFPLAN_SIGNALS = ['pf offplan', 'pf off-plan', 'pf off plan', 'primary plus'];

function normalizePhone(v) {
  if (!v) return null;
  const digits = String(v).replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (digits.length > 12) return digits.slice(-12);
  if (digits.length > 9) return digits.slice(-11);
  return digits;
}

function monthKey(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).slice(0, 7);
  return /^\d{4}-\d{2}$/.test(s) ? s : null;
}

function isPfOffplan(tags = []) {
  const normalized = tags.map((t) => String(t?.name || t || '').toLowerCase().trim());
  return normalized.some((tag) => PF_OFFPLAN_SIGNALS.some((s) => tag.includes(s)));
}

// ── PF API ──────────────────────────────────────────────────────────────────

async function getPfToken() {
  const apiKey = process.env.PF_API_KEY || process.env.PF_KEY;
  const apiSecret = process.env.PF_API_SECRET || process.env.PF_SECRET;
  if (!apiKey || !apiSecret) throw new Error('Missing PF_API_KEY / PF_API_SECRET');
  const res = await fetch(`${PF_API_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret }),
  });
  const data = await res.json();
  if (!res.ok || !data?.accessToken) throw new Error(`PF auth failed: ${JSON.stringify(data)}`);
  return data.accessToken;
}

async function fetchAllPfProjectLeads(token) {
  const all = [];
  let page = 1;
  while (true) {
    process.stdout.write(`  PF leads page ${page} (${all.length} loaded)\r`);
    const res = await fetch(`${PF_API_URL}/leads?perPage=50&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`PF leads failed p${page}: ${res.status}`);
    const data = await res.json();
    const rows = data.data || data.results || [];
    if (!rows.length) break;
    // only project leads
    all.push(...rows.filter((l) => l?.entityType === 'project' || l?.project?.id));
    if (!data.pagination?.nextPage) break;
    page = data.pagination.nextPage;
  }
  process.stdout.write('\n');
  return all;
}

// ── AMO API ──────────────────────────────────────────────────────────────────

function getAmoToken() {
  const raw = fs.readFileSync(TOKENS_FILE, 'utf8');
  return JSON.parse(raw).access_token;
}

async function amoGet(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 204) return {};
  if (!res.ok) throw new Error(`AMO ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function fetchAllAmoLeadsWithTag(token) {
  // Fetch from RE pipeline with contacts embedded
  const RE_PIPELINE = 8696950;
  const all = [];
  let page = 1;
  while (true) {
    process.stdout.write(`  AMO leads page ${page} (${all.length} loaded)\r`);
    const url = `https://${AMO_DOMAIN}/api/v4/leads?filter[pipeline_id]=${RE_PIPELINE}&limit=250&page=${page}&with=tags,contacts`;
    const data = await amoGet(url, token);
    const rows = data?._embedded?.leads || [];
    if (!rows.length) break;
    // filter pf offplan tag
    const tagged = rows.filter((l) => isPfOffplan(l._embedded?.tags || []));
    all.push(...tagged);
    if (rows.length < 250) break;
    page += 1;
  }
  process.stdout.write('\n');
  return all;
}

async function fetchAmoContactPhones(contactIds, token) {
  const result = new Map(); // contactId → [normalizedPhone]
  const CHUNK = 80;
  for (let i = 0; i < contactIds.length; i += CHUNK) {
    const chunk = contactIds.slice(i, i + CHUNK);
    const params = new URLSearchParams({ limit: '250' });
    for (const id of chunk) params.append('filter[id][]', String(id));
    const data = await amoGet(`https://${AMO_DOMAIN}/api/v4/contacts?${params}`, token);
    for (const c of data?._embedded?.contacts || []) {
      const phones = [];
      for (const field of c.custom_fields_values || []) {
        const code = String(field.field_code || '').toUpperCase();
        const name = String(field.field_name || '').toLowerCase();
        if (code !== 'PHONE' && !name.includes('phone') && !name.includes('тел')) continue;
        for (const v of field.values || []) {
          const n = normalizePhone(v.value);
          if (n) phones.push(n);
        }
      }
      if (phones.length) result.set(Number(c.id), [...new Set(phones)]);
    }
  }
  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== PF ↔ AMO Project Match (by phone) ===');

  // 1. PF project leads → phone → projectId + month
  console.log('\n[1] Fetching PF Primary Plus leads...');
  const pfToken = await getPfToken();
  const pfLeads = await fetchAllPfProjectLeads(pfToken);
  console.log(`    Loaded ${pfLeads.length} PF project leads`);

  // phone → Set<projectId>
  const phoneToProjectIds = new Map();
  // phone → month (from PF lead createdAt)
  const phoneToMonth = new Map();

  for (const lead of pfLeads) {
    const pid = lead?.project?.id ? String(lead.project.id) : null;
    if (!pid) continue;

    const rawPhone = lead?.sender?.contacts?.find((c) => c.type === 'phone')?.value
      || lead?.sender?.phone
      || null;
    const phone = normalizePhone(rawPhone);
    if (!phone) continue;

    if (!phoneToProjectIds.has(phone)) phoneToProjectIds.set(phone, new Set());
    phoneToProjectIds.get(phone).add(pid);

    if (!phoneToMonth.has(phone)) phoneToMonth.set(phone, monthKey(lead.createdAt));
  }
  console.log(`    Unique phones in PF: ${phoneToProjectIds.size}`);

  // 2. AMO leads with pf offplan tag → phones
  console.log('\n[2] Fetching AMO leads with "pf offplan" tag...');
  const amoToken = getAmoToken();
  const amoLeads = await fetchAllAmoLeadsWithTag(amoToken);
  console.log(`    Found ${amoLeads.length} AMO leads with pf offplan tag`);

  const allContactIds = [
    ...new Set(
      amoLeads
        .flatMap((l) => (l._embedded?.contacts || []).map((c) => Number(c.id)))
        .filter((id) => id > 0),
    ),
  ];
  console.log(`\n[3] Fetching ${allContactIds.length} AMO contact phone numbers...`);
  const contactPhones = await fetchAmoContactPhones(allContactIds, amoToken);
  console.log(`    Contacts with phones: ${contactPhones.size}`);

  // 3. Match by phone → accumulate per projectId
  console.log('\n[4] Matching...');
  // projectId → { crm_leads: N, crm_leads_by_month: { "2026-04": N } }
  const result = {};
  let totalMatched = 0;

  for (const amoLead of amoLeads) {
    const cids = (amoLead._embedded?.contacts || []).map((c) => Number(c.id)).filter(Boolean);
    const createdMonth = monthKey(new Date(amoLead.created_at * 1000).toISOString());

    let matched = false;
    for (const cid of cids) {
      for (const phone of contactPhones.get(cid) || []) {
        const projectIds = phoneToProjectIds.get(phone);
        if (!projectIds) continue;
        for (const pid of projectIds) {
          if (!result[pid]) result[pid] = { crm_leads: 0, crm_leads_by_month: {} };
          if (!matched) {
            result[pid].crm_leads += 1;
            const month = createdMonth || phoneToMonth.get(phone) || 'unknown';
            result[pid].crm_leads_by_month[month] = (result[pid].crm_leads_by_month[month] || 0) + 1;
            matched = true;
            totalMatched += 1;
          }
        }
      }
    }
  }

  console.log(`    Matched AMO leads: ${totalMatched} across ${Object.keys(result).length} projects`);

  // 4. Save
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const output = {
    generatedAt: new Date().toISOString(),
    totalAmoLeads: amoLeads.length,
    totalPfLeads: pfLeads.length,
    matchedAmoLeads: totalMatched,
    matchedProjects: Object.keys(result).length,
    byProject: result,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✓ Saved to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
