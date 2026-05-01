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
  143,      // закрыто и не реализовано
]);
const QL_ACTUAL_STATUSES = new Set([70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586]);
const MEETING_STATUSES = new Set([142, 70457474, 70457478, 70457482, 70457486, 70757586]);
const DEAL_STATUSES = new Set([142, 70457486, 70757586]);

// Перевіряє чи лід коли-небудь мав статус із QL_ACTUAL_STATUSES (навіть якщо зараз у іншому)
function hasEverBeenInQlActual(lead) {
  // Спершу перевіряємо поточний статус
  const currentStatus = Number(lead.status_id || 0);
  if (QL_ACTUAL_STATUSES.has(currentStatus)) return true;

  // Потім перевіряємо історію
  const history = lead?._embedded?.status_history || [];
  for (const item of history) {
    const status = Number(item?.status_id || 0);
    if (QL_ACTUAL_STATUSES.has(status)) return true;
  }

  return false;
}

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

function normalizeListingRef(value) {
  return String(value || '').trim().toLowerCase();
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
  // "PF:" name prefix is the definitive integration signal for Property Finder leads.
  // channel_type is intentionally excluded — it's a generic contact method field shared
  // across multiple integrations (Facebook, WhatsApp, etc.) and causes false positives.
  return Boolean(
    String(lead.name || '').startsWith('PF:') ||
    tags.has(PF_TAG) ||
    getCustomFieldValue(lead, AMO_PF_FIELD_LEAD_ID) ||
    getCustomFieldValue(lead, AMO_PF_FIELD_LISTING_REF) ||
    getCustomFieldValue(lead, AMO_PF_FIELD_LISTING_URL) ||
    getCustomFieldValue(lead, AMO_PF_FIELD_LISTING_ID)
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
    const url = `https://${AMO_DOMAIN}/api/v4/leads?filter[pipeline_id]=${RE_PIPELINE_ID}&filter[created_at][from]=${from}&filter[created_at][to]=${to}&limit=250&page=${page}&with=contacts,status_history`;
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

async function loadListingCategoryMaps(client) {
  const { rows } = await client.query(
    `
      SELECT listing_id, reference, category, group_name
      FROM pf_listings_snapshot
    `,
  );

  const byReference = new Map();
  const byListingId = new Map();
  const byKey = new Map();
  for (const r of rows) {
    const ref = normalizeListingRef(r.reference);
    const listingId = String(r.listing_id || '').trim();
    const cat = String(r.category || 'Other');
    const groupName = String(r.group_name || 'Our');
    const key = listingId || (ref ? `ref:${ref}` : '');
    const meta = { key, listingId, reference: ref, category: cat, groupName };
    if (ref) byReference.set(ref, meta);
    if (listingId) byListingId.set(listingId, meta);
    if (key) byKey.set(key, meta);
  }
  return { byReference, byListingId, byKey };
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

function ensureListingStatsObj(meta) {
  return {
    listing_id: meta.listingId || null,
    reference: meta.reference || null,
    category: normalizeCategory(meta.category),
    group_name: meta.groupName || 'Our',
    matched_amo_leads: 0,
    spam_count: 0,
    qualified_count: 0,
    ql_actual_count: 0,
    meetings_count: 0,
    deals_count: 0,
    revenue_sum: 0,
    matched_amo_leads_by_month: {},
    spam_by_month: {},
    qualified_by_month: {},
    ql_actual_by_month: {},
    meetings_by_month: {},
    deals_by_month: {},
    revenue_by_month: {},
  };
}

function monthKeyFromUnix(unixTs) {
  if (!Number.isFinite(unixTs) || unixTs <= 0) return null;
  return new Date(unixTs * 1000).toISOString().slice(0, 7);
}

function bumpMonthMap(target, month, delta) {
  if (!month || !delta) return;
  target[month] = Number(target[month] || 0) + Number(delta || 0);
}

function normalizeCategory(rawCategory) {
  const category = String(rawCategory || '').trim();
  if (category === 'Commercial Sell' || category === 'Commercial Rent') return category;
  if (category === 'Sell' || category === 'Rent') return category;
  return 'Other';
}

function monthInRange(monthKey, startDate, endDate) {
  if (!monthKey || monthKey.length < 7) return true;
  const monthStart = `${monthKey.slice(0, 7)}-01`;
  return monthStart >= startDate && monthStart <= endDate;
}

/**
 * Override 'Our' group listing stats with CSV-sourced counts from pf_amo_sync_state.
 * This uses duplicate_count as the weight so that deduplicated PF leads are counted
 * as their true number of AMO leads (matching what AMO CRM shows).
 * This eliminates false positives from the live AMO scan (e.g. Facebook/Oman leads
 * that share the same custom field ID as PF channel type).
 */
async function overrideOurListingStatsFromDb(client, startDate, endDate, listingStats, byReference) {
  const startMonth = startDate.slice(0, 7);
  const endMonth = endDate.slice(0, 7);

  const { rows } = await client.query(
    `
      SELECT
        COALESCE(NULLIF(TRIM(payload->>'pf_listing_ref'), ''), '') AS listing_ref,
        payload->>'created_month' AS created_month,
        SUM((COALESCE(payload->>'duplicate_count', '1'))::int) AS total_leads,
        SUM(CASE WHEN payload->>'isSpam' = 'true' THEN (COALESCE(payload->>'duplicate_count', '1'))::int ELSE 0 END) AS spam_count,
        SUM(CASE WHEN payload->>'isQualified' = 'true' THEN (COALESCE(payload->>'duplicate_count', '1'))::int ELSE 0 END) AS qualified_count,
        SUM(CASE WHEN payload->>'isQlActual' = 'true' THEN (COALESCE(payload->>'duplicate_count', '1'))::int ELSE 0 END) AS ql_actual_count,
        SUM(CASE WHEN payload->>'isMeeting' = 'true' THEN (COALESCE(payload->>'duplicate_count', '1'))::int ELSE 0 END) AS meetings_count
      FROM pf_amo_sync_state
      WHERE payload->>'created_month' >= $1
        AND payload->>'created_month' <= $2
      GROUP BY 1, 2
    `,
    [startMonth, endMonth],
  );

  // Reset all 'Our' and 'Partner'/'AbuDhabi' group listing stats (will be rebuilt from CSV)
  for (const stat of listingStats.values()) {
    if (stat.group_name !== 'Our' && stat.group_name !== 'Partner' && stat.group_name !== 'AbuDhabi') continue;
    stat.matched_amo_leads = 0;
    stat.spam_count = 0;
    stat.qualified_count = 0;
    stat.ql_actual_count = 0;
    stat.meetings_count = 0;
    stat.matched_amo_leads_by_month = {};
    stat.spam_by_month = {};
    stat.qualified_by_month = {};
    stat.ql_actual_by_month = {};
    stat.meetings_by_month = {};
  }

  // Ensure unattributed listing exists for Our group
  if (!listingStats.has('pf-unattributed-listing-leads')) {
    listingStats.set('pf-unattributed-listing-leads', ensureListingStatsObj({ 
      key: 'pf-unattributed-listing-leads',
      listingId: 'pf-unattributed-listing-leads',
      reference: 'Unattributed',
      category: 'Other',
      groupName: 'Our'
    }));
  }

  let totalOverriddenLeads = 0;
  let totalOverriddenSpam = 0;

  for (const row of rows) {
    const listingRef = normalizeListingRef(row.listing_ref);
    const listingMeta = listingRef ? byReference.get(listingRef) : null;
    const isOurListing = listingMeta && (listingMeta.groupName === 'Our' || !listingMeta.groupName);
    const isPartnerListing = listingMeta && (listingMeta.groupName === 'Partner' || listingMeta.groupName === 'AbuDhabi');

    // Partner listing leads → go to the Partner listing stat (not Our/unattributed)
    // Unknown/unmatched listing leads → go to Our unattributed
    const listingKey = isOurListing
      ? listingMeta.key
      : isPartnerListing
        ? listingMeta.key
        : 'pf-unattributed-listing-leads';

    let stat = listingStats.get(listingKey);
    if (!stat) {
      stat = listingStats.get('pf-unattributed-listing-leads');
    }

    if (!stat) continue;

    const month = row.created_month;
    const total = Number(row.total_leads || 0);
    const spam = Number(row.spam_count || 0);
    const qualified = Number(row.qualified_count || 0);
    const qlActual = Number(row.ql_actual_count || 0);
    const meetings = Number(row.meetings_count || 0);

    stat.matched_amo_leads += total;
    bumpMonthMap(stat.matched_amo_leads_by_month, month, total);
    stat.spam_count += spam;
    bumpMonthMap(stat.spam_by_month, month, spam);
    stat.qualified_count += qualified;
    bumpMonthMap(stat.qualified_by_month, month, qualified);
    stat.ql_actual_count += qlActual;
    bumpMonthMap(stat.ql_actual_by_month, month, qlActual);
    stat.meetings_count += meetings;
    bumpMonthMap(stat.meetings_by_month, month, meetings);

    totalOverriddenLeads += total;
    totalOverriddenSpam += spam;
  }

  console.log(`✓ Our group stats overridden from DB: total_leads=${totalOverriddenLeads}, spam=${totalOverriddenSpam}`);
}

async function loadPfLeadsByCategory(client, startDate, endDate) {
  const out = {
    Sell: 0,
    Rent: 0,
    Other: 0,
    'Commercial Sell': 0,
    'Commercial Rent': 0,
  };

  const { rows } = await client.query(
    `
      SELECT category, leads_count, leads_by_month
      FROM pf_listings_snapshot
    `,
  );

  for (const row of rows) {
    const category = normalizeCategory(row.category);
    const leadsByMonth = row.leads_by_month || {};
    const months = Object.keys(leadsByMonth);

    if (months.length > 0) {
      const inRangeLeads = months
        .filter((m) => monthInRange(m, startDate, endDate))
        .reduce((sum, m) => sum + Number(leadsByMonth[m] || 0), 0);
      out[category] += inRangeLeads;
    } else {
      out[category] += Number(row.leads_count || 0);
    }
  }

  return out;
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS pf_amo_match_listing_stats (
        id BIGSERIAL PRIMARY KEY,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        listing_key TEXT NOT NULL,
        listing_id TEXT,
        reference TEXT,
        group_name TEXT,
        category TEXT,
        matched_amo_leads INTEGER NOT NULL DEFAULT 0,
        spam_count INTEGER NOT NULL DEFAULT 0,
        qualified_count INTEGER NOT NULL DEFAULT 0,
        ql_actual_count INTEGER NOT NULL DEFAULT 0,
        meetings_count INTEGER NOT NULL DEFAULT 0,
        deals_count INTEGER NOT NULL DEFAULT 0,
        revenue_sum NUMERIC NOT NULL DEFAULT 0,
        matched_amo_leads_by_month JSONB NOT NULL DEFAULT '{}'::jsonb,
        spam_by_month JSONB NOT NULL DEFAULT '{}'::jsonb,
        qualified_by_month JSONB NOT NULL DEFAULT '{}'::jsonb,
        ql_actual_by_month JSONB NOT NULL DEFAULT '{}'::jsonb,
        meetings_by_month JSONB NOT NULL DEFAULT '{}'::jsonb,
        deals_by_month JSONB NOT NULL DEFAULT '{}'::jsonb,
        revenue_by_month JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (period_start, period_end, listing_key)
      )
    `);

    const { byReference, byListingId, byKey } = await loadListingCategoryMaps(client);

    console.log('Loading PF listing leads by category...');
    const pfLeadsByCategory = await loadPfLeadsByCategory(client, START, END);
    console.log(`PF leads by category: ${JSON.stringify(pfLeadsByCategory)}`);

    const catStats = {
      Sell: ensureStatsObj(),
      Rent: ensureStatsObj(),
      Other: ensureStatsObj(),
      'Commercial Sell': ensureStatsObj(),
      'Commercial Rent': ensureStatsObj(),
    };
    const listingStats = new Map();

    for (const [key, meta] of byKey.entries()) {
      listingStats.set(key, ensureListingStatsObj(meta));
    }

    for (const category of Object.keys(pfLeadsByCategory)) {
      if (catStats[category]) {
        catStats[category].pf_leads = Number(pfLeadsByCategory[category] || 0);
      }
    }

    const amoToken = loadAmoAccessToken();
    console.log('Loading AMO leads...');
    const amoLeads = await fetchAmoLeadsInPipeline(amoToken);
    console.log(`\nAMO leads loaded: ${amoLeads.length}`);

    for (const lead of amoLeads) {
      const directPf = hasDirectPfSignal(lead);
      if (!directPf) continue;

      const listingRef = getCustomFieldValue(lead, AMO_PF_FIELD_LISTING_REF);
      const listingId = getCustomFieldValue(lead, AMO_PF_FIELD_LISTING_ID);
      let listingMeta = byReference.get(normalizeListingRef(listingRef)) || byListingId.get(listingId) || null;
      if (!listingMeta) {
        listingMeta = byKey.get('pf-unattributed-listing-leads') || null;
      }
      const directCategory = listingMeta?.category || 'Other';

      let category = null;
      if (directCategory) {
        category = normalizeCategory(directCategory);
      }

      if (!category) continue;
      const stat = catStats[category] || catStats.Other;
      const status = Number(lead.status_id || 0);
      const price = Number(lead.price || 0);
      const month = monthKeyFromUnix(Number(lead.created_at || 0));

      stat.matched_amo_leads += 1;
      if (listingMeta?.key) {
        const listingStat = listingStats.get(listingMeta.key) || ensureListingStatsObj(listingMeta);
        listingStat.matched_amo_leads += 1;
        bumpMonthMap(listingStat.matched_amo_leads_by_month, month, 1);
        listingStats.set(listingMeta.key, listingStat);
      }

      if (status === SPAM_STATUS) stat.spam_count += 1;
      if (QUALIFIED_STATUSES.has(status)) stat.qualified_count += 1;
      if (hasEverBeenInQlActual(lead)) stat.ql_actual_count += 1;
      if (MEETING_STATUSES.has(status)) stat.meetings_count += 1;
      if (DEAL_STATUSES.has(status)) {
        stat.deals_count += 1;
        stat.revenue_sum += price;
      }

      if (!listingMeta?.key) continue;
      const listingStat = listingStats.get(listingMeta.key) || ensureListingStatsObj(listingMeta);
      if (status === SPAM_STATUS) {
        listingStat.spam_count += 1;
        bumpMonthMap(listingStat.spam_by_month, month, 1);
      }
      if (QUALIFIED_STATUSES.has(status)) {
        listingStat.qualified_count += 1;
        bumpMonthMap(listingStat.qualified_by_month, month, 1);
      }
      if (hasEverBeenInQlActual(lead)) {
        listingStat.ql_actual_count += 1;
        bumpMonthMap(listingStat.ql_actual_by_month, month, 1);
      }
      if (MEETING_STATUSES.has(status)) {
        listingStat.meetings_count += 1;
        bumpMonthMap(listingStat.meetings_by_month, month, 1);
      }
      if (DEAL_STATUSES.has(status)) {
        listingStat.deals_count += 1;
        listingStat.revenue_sum += price;
        bumpMonthMap(listingStat.deals_by_month, month, 1);
        bumpMonthMap(listingStat.revenue_by_month, month, price);
      }
      listingStats.set(listingMeta.key, listingStat);
    }

    // Override 'Our' group listing stats with CSV-sourced counts from pf_amo_sync_state.
    console.log('Overriding Our group listing stats from pf_amo_sync_state (CSV ground truth)...');
    await overrideOurListingStatsFromDb(client, START, END, listingStats, byReference);

    // Delete all stale 'Our' group rows for this period before re-inserting.
    // Old syncs may have written different listing_keys (now obsolete) that would
    // otherwise accumulate and inflate totals.
    const currentOurKeys = Array.from(listingStats.entries())
      .filter(([, s]) => s.group_name === 'Our')
      .map(([k]) => k);
    if (currentOurKeys.length > 0) {
      await client.query(
        `DELETE FROM pf_amo_match_listing_stats
         WHERE group_name = 'Our'
           AND period_start = $1
           AND period_end = $2
           AND listing_key != ALL($3::text[])`,
        [START, END, currentOurKeys],
      );
      console.log(`✓ Deleted stale Our listing rows (kept ${currentOurKeys.length} current keys)`);
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

    for (const [listingKey, stat] of listingStats.entries()) {
      await client.query(
        `
          INSERT INTO pf_amo_match_listing_stats (
            period_start, period_end, listing_key, listing_id, reference, group_name, category,
            matched_amo_leads, spam_count, qualified_count, ql_actual_count,
            meetings_count, deals_count, revenue_sum,
            matched_amo_leads_by_month, spam_by_month, qualified_by_month,
            ql_actual_by_month, meetings_by_month, deals_by_month, revenue_by_month,
            updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,
            $12,$13,$14,
            $15::jsonb,$16::jsonb,$17::jsonb,
            $18::jsonb,$19::jsonb,$20::jsonb,$21::jsonb,
            NOW()
          )
          ON CONFLICT (period_start, period_end, listing_key)
          DO UPDATE SET
            listing_id = EXCLUDED.listing_id,
            reference = EXCLUDED.reference,
            group_name = EXCLUDED.group_name,
            category = EXCLUDED.category,
            matched_amo_leads = EXCLUDED.matched_amo_leads,
            spam_count = EXCLUDED.spam_count,
            qualified_count = EXCLUDED.qualified_count,
            ql_actual_count = EXCLUDED.ql_actual_count,
            meetings_count = EXCLUDED.meetings_count,
            deals_count = EXCLUDED.deals_count,
            revenue_sum = EXCLUDED.revenue_sum,
            matched_amo_leads_by_month = EXCLUDED.matched_amo_leads_by_month,
            spam_by_month = EXCLUDED.spam_by_month,
            qualified_by_month = EXCLUDED.qualified_by_month,
            ql_actual_by_month = EXCLUDED.ql_actual_by_month,
            meetings_by_month = EXCLUDED.meetings_by_month,
            deals_by_month = EXCLUDED.deals_by_month,
            revenue_by_month = EXCLUDED.revenue_by_month,
            updated_at = NOW()
        `,
        [
          START,
          END,
          listingKey,
          stat.listing_id,
          stat.reference,
          stat.group_name,
          stat.category,
          stat.matched_amo_leads,
          stat.spam_count,
          stat.qualified_count,
          stat.ql_actual_count,
          stat.meetings_count,
          stat.deals_count,
          stat.revenue_sum,
          JSON.stringify(stat.matched_amo_leads_by_month),
          JSON.stringify(stat.spam_by_month),
          JSON.stringify(stat.qualified_by_month),
          JSON.stringify(stat.ql_actual_by_month),
          JSON.stringify(stat.meetings_by_month),
          JSON.stringify(stat.deals_by_month),
          JSON.stringify(stat.revenue_by_month),
        ],
      );
    }

    console.log('SUCCESS: sync_pf_amo_match_stats');
    console.log(JSON.stringify({ period: { START, END }, stats: catStats, listingRows: listingStats.size }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('FAILED: sync_pf_amo_match_stats', e?.message || e);
  process.exit(1);
});
