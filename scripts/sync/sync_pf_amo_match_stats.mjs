import 'dotenv/config';
import fs from 'fs';
import { Client } from 'pg';

const PF_API_URL = 'https://atlas.propertyfinder.com/v1';
const AMO_DOMAIN = 'reforyou.amocrm.ru';
const RE_PIPELINE_ID = 8696950;
const TOKENS_PATH = 'secrets/amo_tokens.json';
const PF_TAG = 'property-finder';

const AMO_PF_FIELD_LEAD_ID = Number(process.env.AMO_PF_FIELD_LEAD_ID || 1462131);
const AMO_PF_FIELD_CHANNEL_TYPE = Number(process.env.AMO_PF_FIELD_CHANNEL_TYPE || 1450527);
const AMO_PF_FIELD_LISTING_REF = Number(process.env.AMO_PF_FIELD_LISTING_REF || 1526392);
const AMO_PF_FIELD_LISTING_URL = Number(process.env.AMO_PF_FIELD_LISTING_URL || 1526390);
const AMO_PF_FIELD_LISTING_ID = Number(process.env.AMO_PF_FIELD_LISTING_ID || 1526388);

const START = process.env.PF_MATCH_START_DATE || '2026-01-01';
const END = process.env.PF_MATCH_END_DATE || new Date().toISOString().slice(0, 10);

const SPAM_STATUS = 143;
const QUALIFIED_STATUSES = new Set([
  70457466, // квалификация пройдена
  70457470, // презентация назначена
  70457474, // презентация проведена
  70457478, // показ назначен
  70457482, // EOI / чек получен
  70457486, // Документы подписаны (F/SPA)
  70757586, // POST SALES
  74717798, // ПАРТНЕРЫ
  74717802, // ЛИСТИНГ
  70457490, // отложенный спрос
  82310010, // Реанимация
  142,      // квартира оплачена
]);
const QL_ACTUAL_STATUSES = new Set([70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586]);
const MEETING_STATUSES = new Set([142, 70457474, 70457478, 70457482, 70457486, 70757586]);
const DEAL_STATUSES = new Set([142, 70457486, 70757586]);

function getConnectionString() {
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DB;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  if (!host || !database || !user || !password) {
    throw new Error('Missing PostgreSQL env');
  }
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?sslmode=require`;
}

function normalizePhone(v) {
  if (!v) return null;
  const d = String(v).replace(/\D/g, '');
  if (!d) return null;
  if (d.length > 12) return d.slice(-12);
  if (d.length > 9) return d.slice(-11);
  return d;
}

function tsStart(date) {
  return Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / 1000);
}

function tsEnd(date) {
  return Math.floor(new Date(`${date}T23:59:59.000Z`).getTime() / 1000);
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function getPfToken() {
  const apiKey = process.env.PF_API_KEY;
  const apiSecret = process.env.PF_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('Missing PF_API_KEY/PF_API_SECRET');

  const res = await fetchWithTimeout(`${PF_API_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret }),
  });
  const data = await res.json();
  if (!res.ok || !data?.accessToken) throw new Error(`PF token error: ${JSON.stringify(data)}`);
  return data.accessToken;
}

async function fetchPfLeads2026() {
  const token = await getPfToken();
  const out = [];
  let page = 1;

  while (true) {
    if (page % 20 === 0) process.stdout.write(`PF leads page ${page} (loaded ${out.length})      \r`);
    const res = await fetchWithTimeout(`${PF_API_URL}/leads?perPage=50&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PF leads fetch failed page ${page}: ${res.status} ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const rows = data.data || data.results || [];
    if (!rows.length) break;
    out.push(...rows);
    if (!data.pagination?.nextPage) break;
    page = data.pagination.nextPage;
  }

  return out.filter((l) => {
    const d = String(l.createdAt || '').slice(0, 10);
    return d >= START && d <= END;
  });
}

function loadAmoAccessToken() {
  if (process.env.AMO_TOKENS_JSON) {
    const parsed = JSON.parse(process.env.AMO_TOKENS_JSON);
    if (parsed?.access_token) return parsed.access_token;
  }
  const raw = fs.readFileSync(TOKENS_PATH, 'utf8');
  return JSON.parse(raw).access_token;
}

function getCustomFieldValue(lead, fieldId) {
  const field = (lead.custom_fields_values || []).find((item) => Number(item.field_id) === Number(fieldId));
  const value = field?.values?.[0]?.value;
  return value == null ? '' : String(value).trim();
}

function getLeadTags(lead) {
  return new Set((lead?._embedded?.tags || []).map((tag) => String(tag?.name || '').trim().toLowerCase()).filter(Boolean));
}

function hasDirectPfSignal(lead) {
  const tags = getLeadTags(lead);
  return Boolean(
    tags.has(PF_TAG) ||
    getCustomFieldValue(lead, AMO_PF_FIELD_LEAD_ID) ||
    getCustomFieldValue(lead, AMO_PF_FIELD_LISTING_REF) ||
    getCustomFieldValue(lead, AMO_PF_FIELD_LISTING_URL) ||
    getCustomFieldValue(lead, AMO_PF_FIELD_LISTING_ID) ||
    getCustomFieldValue(lead, AMO_PF_FIELD_CHANNEL_TYPE)
  );
}

async function amoFetch(url, token) {
  const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AMO request failed ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchAmoLeadsInPipeline(token) {
  const out = [];
  let page = 1;
  const from = tsStart(START);
  const to = tsEnd(END);

  while (true) {
    if (page % 10 === 0) process.stdout.write(`AMO leads page ${page} (loaded ${out.length})      \r`);
    const url = `https://${AMO_DOMAIN}/api/v4/leads?filter[pipeline_id]=${RE_PIPELINE_ID}&filter[created_at][from]=${from}&filter[created_at][to]=${to}&limit=250&page=${page}&with=contacts`;
    const data = await amoFetch(url, token);
    const rows = data?._embedded?.leads || [];
    if (!rows.length) break;
    out.push(...rows);
    if (rows.length < 250) break;
    page += 1;
  }

  return out;
}

async function fetchAmoContactsByIds(ids, token) {
  const result = new Map();
  const chunkSize = 80;

  for (let i = 0; i < ids.length; i += chunkSize) {
    if (i % (chunkSize * 10) === 0) {
      process.stdout.write(`AMO contacts chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(ids.length / chunkSize)}      \r`);
    }
    const chunk = ids.slice(i, i + chunkSize);
    const params = new URLSearchParams();
    params.set('limit', '250');
    for (const id of chunk) params.append('filter[id][]', String(id));

    const data = await amoFetch(`https://${AMO_DOMAIN}/api/v4/contacts?${params.toString()}`, token);
    const contacts = data?._embedded?.contacts || [];

    for (const c of contacts) {
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
      if (phones.length) result.set(Number(c.id), Array.from(new Set(phones)));
    }
  }

  return result;
}

async function loadReferenceCategoryMap(client) {
  const { rows } = await client.query(
    `
      SELECT reference, category
      FROM pf_listings_snapshot
      WHERE reference IS NOT NULL
    `,
  );

  const m = new Map();
  for (const r of rows) {
    const ref = String(r.reference || '').trim();
    const cat = String(r.category || 'Other');
    if (!ref) continue;
    m.set(ref, cat);
  }
  return m;
}

function ensureStatsObj() {
  return {
    pf_leads: 0,
    matched_amo_leads: 0,
    spam_count: 0,
    qualified_count: 0,
    ql_actual_count: 0,
    meetings_count: 0,
    deals_count: 0,
    revenue_sum: 0,
  };
}

async function main() {
  const connectionString = getConnectionString();
  const sslMode = (process.env.POSTGRES_SSL_MODE || 'require').toLowerCase();
  const client = new Client({
    connectionString,
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS pf_amo_match_stats (
        id BIGSERIAL PRIMARY KEY,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        category TEXT NOT NULL,
        pf_leads INTEGER NOT NULL DEFAULT 0,
        matched_amo_leads INTEGER NOT NULL DEFAULT 0,
        match_rate NUMERIC NOT NULL DEFAULT 0,
        spam_count INTEGER NOT NULL DEFAULT 0,
        qualified_count INTEGER NOT NULL DEFAULT 0,
        ql_actual_count INTEGER NOT NULL DEFAULT 0,
        meetings_count INTEGER NOT NULL DEFAULT 0,
        deals_count INTEGER NOT NULL DEFAULT 0,
        revenue_sum NUMERIC NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (period_start, period_end, category)
      )
    `);

    const refToCategory = await loadReferenceCategoryMap(client);

    console.log('Loading PF leads...');
    const pfLeads = await fetchPfLeads2026();
    console.log(`\nPF leads loaded: ${pfLeads.length}`);

    const pfPhoneCategoryCounts = new Map();
    const catStats = {
      Sell: ensureStatsObj(),
      Rent: ensureStatsObj(),
      Other: ensureStatsObj(),
      'Commercial Sell': ensureStatsObj(),
      'Commercial Rent': ensureStatsObj(),
    };

    for (const lead of pfLeads) {
      const rawPhone = lead.sender?.contacts?.find((c) => c.type === 'phone')?.value;
      const phone = normalizePhone(rawPhone);
      if (!phone) continue;

      const ref = String(lead.listing?.reference || '').trim();
      const category = refToCategory.get(ref) || 'Other';
      // Keep Commercial Sell/Rent as-is, normalize others
      const normalizedCategory =
        category === 'Commercial Sell' || category === 'Commercial Rent'
          ? category
          : category === 'Sell' || category === 'Rent'
            ? category
            : 'Other';

      catStats[normalizedCategory].pf_leads += 1;

      if (!pfPhoneCategoryCounts.has(phone)) {
        pfPhoneCategoryCounts.set(phone, { Sell: 0, Rent: 0, Other: 0, 'Commercial Sell': 0, 'Commercial Rent': 0 });
      }
      pfPhoneCategoryCounts.get(phone)[normalizedCategory] += 1;
    }

    const phonePrimaryCategory = new Map();
    for (const [phone, counts] of pfPhoneCategoryCounts.entries()) {
      const ordered = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      phonePrimaryCategory.set(phone, ordered[0][0]);
    }

    const amoToken = loadAmoAccessToken();
    console.log('Loading AMO leads...');
    const amoLeads = await fetchAmoLeadsInPipeline(amoToken);
    console.log(`\nAMO leads loaded: ${amoLeads.length}`);

    const contactIds = Array.from(
      new Set(
        amoLeads
          .flatMap((l) => (l._embedded?.contacts || []).map((c) => Number(c.id)))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );

    const contactPhonesMap = await fetchAmoContactsByIds(contactIds, amoToken);
    console.log(`\nAMO contacts with phones loaded: ${contactPhonesMap.size}`);

    for (const lead of amoLeads) {
      const directPf = hasDirectPfSignal(lead);
      const listingRef = getCustomFieldValue(lead, AMO_PF_FIELD_LISTING_REF);
      const directCategory = refToCategory.get(listingRef) || (directPf ? 'Other' : null);

      let category = null;
      if (directCategory) {
        category =
          directCategory === 'Commercial Sell' || directCategory === 'Commercial Rent'
            ? directCategory
            : directCategory === 'Sell' || directCategory === 'Rent'
              ? directCategory
              : 'Other';
      }

      const cids = (lead._embedded?.contacts || []).map((c) => Number(c.id)).filter(Boolean);
      if (!category) {
        if (!cids.length) continue;

        for (const cid of cids) {
          const phones = contactPhonesMap.get(cid) || [];
          for (const p of phones) {
            if (phonePrimaryCategory.has(p)) {
              category = phonePrimaryCategory.get(p);
              break;
            }
          }
          if (category) break;
        }
      }

      if (!category) continue;
      const stat = catStats[category] || catStats.Other;

      stat.matched_amo_leads += 1;
      const status = Number(lead.status_id || 0);
      const price = Number(lead.price || 0);

      if (status === SPAM_STATUS) stat.spam_count += 1;
      if (QUALIFIED_STATUSES.has(status)) stat.qualified_count += 1;
      if (QL_ACTUAL_STATUSES.has(status)) stat.ql_actual_count += 1;
      if (MEETING_STATUSES.has(status)) stat.meetings_count += 1;
      if (DEAL_STATUSES.has(status)) {
        stat.deals_count += 1;
        stat.revenue_sum += price;
      }
    }

    for (const category of ['Sell', 'Rent', 'Other', 'Commercial Sell', 'Commercial Rent']) {
      const stat = catStats[category];
      const matchRate = stat.pf_leads > 0 ? stat.matched_amo_leads / stat.pf_leads : 0;

      await client.query(
        `
          INSERT INTO pf_amo_match_stats (
            period_start, period_end, category,
            pf_leads, matched_amo_leads, match_rate,
            spam_count, qualified_count, ql_actual_count,
            meetings_count, deals_count, revenue_sum,
            updated_at
          ) VALUES (
            $1,$2,$3,
            $4,$5,$6,
            $7,$8,$9,
            $10,$11,$12,
            NOW()
          )
          ON CONFLICT (period_start, period_end, category)
          DO UPDATE SET
            pf_leads = EXCLUDED.pf_leads,
            matched_amo_leads = EXCLUDED.matched_amo_leads,
            match_rate = EXCLUDED.match_rate,
            spam_count = EXCLUDED.spam_count,
            qualified_count = EXCLUDED.qualified_count,
            ql_actual_count = EXCLUDED.ql_actual_count,
            meetings_count = EXCLUDED.meetings_count,
            deals_count = EXCLUDED.deals_count,
            revenue_sum = EXCLUDED.revenue_sum,
            updated_at = NOW()
        `,
        [
          START,
          END,
          category,
          stat.pf_leads,
          stat.matched_amo_leads,
          matchRate,
          stat.spam_count,
          stat.qualified_count,
          stat.ql_actual_count,
          stat.meetings_count,
          stat.deals_count,
          stat.revenue_sum,
        ],
      );
    }

    console.log('SUCCESS: sync_pf_amo_match_stats');
    console.log(JSON.stringify({ period: { START, END }, stats: catStats }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('FAILED: sync_pf_amo_match_stats', e?.message || e);
  process.exit(1);
});
