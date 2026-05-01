/**
 * Matches PF Primary Plus leads (entityType=project from PF API)
 * with AMO CRM leads from PF integration by phone number.
 *
 * Historical leads source: data/cache/pf_amo_leads_csv.json
 *   (generated from amocrm_export_leads_2026-05-01.csv via import_pf_amo_csv.mjs)
 * Delta sync: AMO API queried only for leads created AFTER csv_last_lead_at.
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
const CSV_CACHE_FILE = path.resolve(ROOT, 'data/cache/pf_amo_leads_csv.json');

const AMO_SOURCE_FIELD_ID = Number(process.env.AMO_SOURCE_FIELD_ID || 703131); // "Источник"
const AMO_PF_SOURCE_ENUM_ID = Number(process.env.AMO_PF_SOURCE_ENUM_ID || 695183); // "Property finder"
const AMO_RE_PIPELINE_ID = Number(process.env.AMO_PF_PIPELINE_ID || 8696950);

// AMO status ID classification (mirrors sync_pf_amo_match_stats.mjs)
const SPAM_STATUS = 143;
const QUALIFIED_STATUSES = new Set([
  70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586,
  74717798, 74717802, 70457490, 82310010, 142, 143,
]);
const QL_ACTUAL_STATUSES = new Set([70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586]);
const MEETING_STATUSES = new Set([142, 70457474, 70457478, 70457482, 70457486, 70757586]);
const DEAL_STATUSES = new Set([142, 70457486, 70757586]);

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

function hasPfSourceEnum(lead) {
  const sourceField = (lead?.custom_fields_values || []).find(
    (f) => Number(f?.field_id) === AMO_SOURCE_FIELD_ID,
  );
  if (!sourceField) return false;
  return (sourceField.values || []).some((v) => Number(v?.enum_id) === AMO_PF_SOURCE_ENUM_ID);
}

// ── CSV historical cache ─────────────────────────────────────────────────────

/**
 * Load historical AMO leads from CSV cache (data/cache/pf_amo_leads_csv.json).
 * Returns { leads: NormalizedLead[], csvLastLeadAt: number|null }
 *
 * NormalizedLead = { id, created_at, created_month, phones[], isSpam, isQualified,
 *                    isQlActual, isMeeting, isDeal }
 */
function loadCsvCache() {
  if (!fs.existsSync(CSV_CACHE_FILE)) return { leads: [], csvLastLeadAt: null };
  const raw = JSON.parse(fs.readFileSync(CSV_CACHE_FILE, 'utf8'));
  return {
    leads: raw.leads || [],
    csvLastLeadAt: raw.csv_last_lead_at || null,
  };
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

/**
 * Fetch AMO leads from the RE pipeline that:
 *  - have PF source enum
 *  - were created AFTER deltaFromTs (to avoid re-fetching CSV leads)
 */
async function fetchDeltaAmoLeads(token, deltaFromTs) {
  const all = [];
  let page = 1;
  // AMO filter[created_at][from] = unix timestamp
  const fromParam = deltaFromTs ? `&filter[created_at][from]=${deltaFromTs}` : '';
  while (true) {
    process.stdout.write(`  AMO delta page ${page} (${all.length} loaded)\r`);
    const url = `https://${AMO_DOMAIN}/api/v4/leads?filter[pipeline_id]=${AMO_RE_PIPELINE_ID}&limit=250&page=${page}&with=contacts${fromParam}`;
    const data = await amoGet(url, token);
    const rows = data?._embedded?.leads || [];
    if (!rows.length) break;
    const pfLeads = rows.filter((l) => hasPfSourceEnum(l));
    all.push(...pfLeads);
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

  // 2. Load historical leads from CSV cache
  console.log('\n[2] Loading historical leads from CSV cache...');
  const { leads: csvLeads, csvLastLeadAt } = loadCsvCache();
  console.log(`    Loaded ${csvLeads.length} historical leads from CSV (last: ${csvLastLeadAt ? new Date(csvLastLeadAt * 1000).toISOString() : 'n/a'})`);

  // 3. Fetch new AMO leads created AFTER the CSV export cutoff
  // Add a small overlap buffer (60s) to avoid missing leads at boundary
  const deltaFromTs = csvLastLeadAt ? csvLastLeadAt - 60 : null;
  const amoToken = getAmoToken();
  let deltaLeads = [];
  if (deltaFromTs) {
    console.log(`\n[3] Fetching AMO delta leads after ${new Date(deltaFromTs * 1000).toISOString()}...`);
    deltaLeads = await fetchDeltaAmoLeads(amoToken, deltaFromTs);
    console.log(`    Found ${deltaLeads.length} new AMO leads since CSV export`);
  } else {
    console.log('\n[3] No CSV cache cutoff — skipping AMO delta fetch');
  }

  // Fetch phones for delta AMO leads (CSV leads already have phones)
  let contactPhones = new Map();
  if (deltaLeads.length > 0) {
    const allContactIds = [
      ...new Set(
        deltaLeads
          .flatMap((l) => (l._embedded?.contacts || []).map((c) => Number(c.id)))
          .filter((id) => id > 0),
      ),
    ];
    console.log(`    Fetching ${allContactIds.length} contact phones for delta leads...`);
    contactPhones = await fetchAmoContactPhones(allContactIds, amoToken);
    console.log(`    Contacts with phones: ${contactPhones.size}`);
  }

  // 4. Match by phone → accumulate per projectId
  console.log('\n[4] Matching...');
  const result = {};
  let totalMatched = 0;

  function accumulateLead(phones, createdMonth, isSpam, isQualified, isQlActual, isMeeting, isDeal) {
    let matched = false;
    for (const phone of phones) {
      const projectIds = phoneToProjectIds.get(phone);
      if (!projectIds) continue;
      for (const pid of projectIds) {
        if (!result[pid]) result[pid] = {
          crm_leads: 0, spam: 0, qualified_leads: 0, ql_actual: 0, meetings: 0, deals: 0,
          crm_leads_by_month: {}, spam_by_month: {}, qualified_leads_by_month: {},
          ql_actual_by_month: {}, meetings_by_month: {}, deals_by_month: {},
        };
        if (!matched) {
          const r = result[pid];
          const month = createdMonth || phoneToMonth.get(phone) || 'unknown';
          r.crm_leads += 1;
          r.crm_leads_by_month[month] = (r.crm_leads_by_month[month] || 0) + 1;
          if (isSpam) { r.spam += 1; r.spam_by_month[month] = (r.spam_by_month[month] || 0) + 1; }
          if (isQualified) { r.qualified_leads += 1; r.qualified_leads_by_month[month] = (r.qualified_leads_by_month[month] || 0) + 1; }
          if (isQlActual) { r.ql_actual += 1; r.ql_actual_by_month[month] = (r.ql_actual_by_month[month] || 0) + 1; }
          if (isMeeting) { r.meetings += 1; r.meetings_by_month[month] = (r.meetings_by_month[month] || 0) + 1; }
          if (isDeal) { r.deals += 1; r.deals_by_month[month] = (r.deals_by_month[month] || 0) + 1; }
          matched = true;
          totalMatched += 1;
        }
      }
    }
  }

  // 4a. Match CSV historical leads (phones already normalized)
  for (const lead of csvLeads) {
    accumulateLead(
      lead.phones,
      lead.created_month,
      lead.isSpam,
      lead.isQualified,
      lead.isQlActual,
      lead.isMeeting,
      lead.isDeal,
    );
  }

  // 4b. Match AMO delta leads (phones via contacts API)
  for (const amoLead of deltaLeads) {
    const cids = (amoLead._embedded?.contacts || []).map((c) => Number(c.id)).filter(Boolean);
    const phones = [...new Set(
      cids.flatMap((cid) => contactPhones.get(cid) || []),
    )];
    const createdMonth = monthKey(new Date(amoLead.created_at * 1000).toISOString());
    const statusId = Number(amoLead.status_id || 0);
    accumulateLead(
      phones,
      createdMonth,
      statusId === SPAM_STATUS,
      QUALIFIED_STATUSES.has(statusId),
      QL_ACTUAL_STATUSES.has(statusId),
      MEETING_STATUSES.has(statusId),
      DEAL_STATUSES.has(statusId),
    );
  }

  console.log(`    Matched leads: ${totalMatched} across ${Object.keys(result).length} projects (${csvLeads.length} historical + ${deltaLeads.length} delta)`);

  // 5. Save
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const output = {
    generatedAt: new Date().toISOString(),
    totalAmoLeads: csvLeads.length + deltaLeads.length,
    historicalLeads: csvLeads.length,
    deltaLeads: deltaLeads.length,
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
