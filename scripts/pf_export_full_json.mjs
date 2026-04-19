import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { BigQuery } from '@google-cloud/bigquery';

dotenv.config({ path: '.env' });

const API_URL = 'https://atlas.propertyfinder.com/v1';
const BQ_PROJECT_ID = process.env.BQ_PROJECT_ID || 'crypto-world-epta';
const BQ_DATASET_ID = process.env.BQ_DATASET_ID || 'foryou_analytics';
const BQ_PF_EFFICACY_VIEW = process.env.BQ_PF_EFFICACY_VIEW || 'pf_efficacy_master';
const BQ_KEY_FILE = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');
const PF_CREDIT_TO_AED = 1.327;
const PF_CREDITS_TX_TYPE = 'credits';
const LISTING_STATES = ['live', 'archived', 'unpublished', 'takendown'];

const LISTING_CONFIGS = [
  { table: 'our', type: 'Sell', category: 'residential', offeringType: 'sale', group: 'Our' },
  { table: 'our', type: 'Rent', category: 'residential', offeringType: 'rent', group: 'Our' },
  { table: 'partner', type: 'Commercial Sell', category: 'commercial', offeringType: 'sale', group: 'Partner' },
  { table: 'partner', type: 'Commercial Rent', category: 'commercial', offeringType: 'rent', group: 'Partner' },
];

function monthKey(dateLike) {
  const v = String(dateLike || '');
  return v.length >= 7 ? v.slice(0, 7) : '';
}

function toNumber(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function safeDivide(a, b) {
  const den = toNumber(b);
  if (den <= 0) return 0;
  return toNumber(a) / den;
}

function round2(v) {
  return Math.round(toNumber(v) * 100) / 100;
}

function normalizeListingRef(v) {
  return String(v || '').trim().toUpperCase();
}

async function fetchCrmMatchedLeadMaps() {
  try {
    const credentials = process.env.GOOGLE_AUTH_JSON ? JSON.parse(process.env.GOOGLE_AUTH_JSON) : undefined;
    const bq = new BigQuery({
      projectId: BQ_PROJECT_ID,
      credentials,
      keyFilename: credentials ? undefined : BQ_KEY_FILE,
      location: 'europe-central2',
    });

    const tableRef = `\`${BQ_PROJECT_ID}.${BQ_DATASET_ID}.${BQ_PF_EFFICACY_VIEW}\``;

    const monthlyQuery = `
      SELECT
        CAST(listing_ref AS STRING) AS listing_ref,
        FORMAT_TIMESTAMP('%Y-%m', pf_created_at) AS month,
        COUNTIF(crm_lead_id IS NOT NULL) AS matched_leads
      FROM ${tableRef}
      WHERE pf_deal_type != 'project'
        AND listing_ref IS NOT NULL
        AND CAST(listing_ref AS STRING) != ''
        AND pf_created_at IS NOT NULL
      GROUP BY listing_ref, month
    `;

    const statsQuery = `
      SELECT
        COUNT(*) AS total_pf_rows,
        COUNTIF(crm_lead_id IS NOT NULL) AS matched_pf_rows,
        MAX(pf_created_at) AS last_pf_created_at
      FROM ${tableRef}
      WHERE pf_deal_type != 'project'
    `;

    const [monthlyRows] = await bq.query(monthlyQuery);
    const [statsRows] = await bq.query(statsQuery);

    const byListingRef = new Map();
    for (const row of monthlyRows || []) {
      const ref = normalizeListingRef(row?.listing_ref);
      const month = String(row?.month || '').trim();
      if (!ref || !month) continue;

      if (!byListingRef.has(ref)) byListingRef.set(ref, { total: 0, byMonth: {} });
      const agg = byListingRef.get(ref);
      const matched = toNumber(row?.matched_leads);
      agg.total += matched;
      agg.byMonth[month] = (agg.byMonth[month] || 0) + matched;
    }

    const stats = statsRows?.[0] || {};
    return {
      available: true,
      byListingRef,
      stats: {
        total_pf_rows: toNumber(stats.total_pf_rows),
        matched_pf_rows: toNumber(stats.matched_pf_rows),
        last_pf_created_at: stats.last_pf_created_at || null,
      },
    };
  } catch (err) {
    return {
      available: false,
      byListingRef: new Map(),
      stats: null,
      error: err?.message || String(err),
    };
  }
}

async function getToken() {
  const apiKey = process.env.PF_API_KEY;
  const apiSecret = process.env.PF_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('Missing PF_API_KEY/PF_API_SECRET in .env');

  const res = await fetch(`${API_URL}/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ apiKey, apiSecret }),
  });

  const data = await res.json();
  if (!res.ok || !data?.accessToken) {
    throw new Error(`PF auth/token failed: ${JSON.stringify(data)}`);
  }
  return data.accessToken;
}

async function fetchPaginated(urlBuilder, token) {
  const all = [];
  let page = 1;

  while (true) {
    const url = urlBuilder(page);
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`PF request failed (${url}): ${JSON.stringify(data)}`);
    }

    const rows = data.results || data.data || [];
    if (!rows.length) break;

    all.push(...rows);

    if (!data.pagination?.nextPage) break;
    page = data.pagination.nextPage;
    if (page > 2000) break;
  }

  return all;
}

async function fetchAllListings(token) {
  const byConfig = {};

  for (const cfg of LISTING_CONFIGS) {
    const rows = [];

    for (const state of LISTING_STATES) {
      const stateRows = await fetchPaginated(
        (page) => `${API_URL}/listings?filter[category]=${encodeURIComponent(cfg.category)}&filter[offeringType]=${encodeURIComponent(cfg.offeringType)}&filter[state]=${encodeURIComponent(state)}&perPage=50&page=${page}`,
        token,
      );

      for (const row of stateRows) {
        rows.push({
          ...row,
          __state: state,
          __table: cfg.table,
          __type: cfg.type,
          __group: cfg.group,
          __category: cfg.category,
          __offeringType: cfg.offeringType,
        });
      }
    }

    const dedup = new Map();
    for (const row of rows) {
      const key = String(row.id || row.reference || '');
      if (!key) continue;
      if (!dedup.has(key)) dedup.set(key, row);
    }

    byConfig[cfg.type] = Array.from(dedup.values());
  }

  return byConfig;
}

async function fetchAllCreditsTransactions(token) {
  return fetchPaginated(
    (page) => `${API_URL}/credits/transactions?type=${encodeURIComponent(PF_CREDITS_TX_TYPE)}&perPage=50&page=${page}`,
    token,
  );
}

async function fetchAllLeads(token) {
  return fetchPaginated((page) => `${API_URL}/leads?perPage=50&page=${page}`, token);
}

async function fetchProjectDetails(projectIds, token) {
  const out = new Map();
  const ids = Array.from(projectIds);

  const chunkSize = 12;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);

    const results = await Promise.all(
      chunk.map(async (id) => {
        try {
          const res = await fetch(`${API_URL}/projects/${encodeURIComponent(id)}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          });
          const data = await res.json();
          if (!res.ok) return [id, null];
          return [id, data];
        } catch {
          return [id, null];
        }
      }),
    );

    for (const [id, data] of results) {
      out.set(id, data);
    }
  }

  return out;
}

function buildListingBudgetMaps(transactions) {
  const byRef = new Map();

  for (const tx of transactions) {
    const action = tx?.transactionInfo?.action;
    const type = tx?.transactionInfo?.type;
    if (!(action === 'charge' && type === 'credits')) continue;

    const ref = tx?.listingInfo?.reference;
    if (!ref) continue;

    const amount = Math.abs(toNumber(tx?.transactionInfo?.amount));
    const month = monthKey(tx?.createdAt) || 'unknown';

    if (!byRef.has(ref)) byRef.set(ref, { totalCredits: 0, byMonth: {} });
    const row = byRef.get(ref);

    row.totalCredits += amount;
    row.byMonth[month] = (row.byMonth[month] || 0) + amount;
  }

  return byRef;
}

function buildProjectBudgetMaps(transactions) {
  const byProjectId = new Map();

  for (const tx of transactions) {
    const action = tx?.transactionInfo?.action;
    const type = tx?.transactionInfo?.type;
    if (!(action === 'charge' && type === 'credits')) continue;

    const pid = tx?.projectInfo?.id;
    if (!pid) continue;

    const amount = Math.abs(toNumber(tx?.transactionInfo?.amount));
    const month = monthKey(tx?.createdAt) || 'unknown';

    if (!byProjectId.has(pid)) byProjectId.set(pid, { totalCredits: 0, byMonth: {} });
    const row = byProjectId.get(pid);

    row.totalCredits += amount;
    row.byMonth[month] = (row.byMonth[month] || 0) + amount;
  }

  return byProjectId;
}

function buildListingLeadMaps(leads) {
  const byListingId = new Map();
  const byListingRef = new Map();

  for (const lead of leads) {
    const listing = lead?.listing;
    if (!listing?.id && !listing?.reference) continue;

    const lid = listing?.id ? String(listing.id) : null;
    const ref = listing?.reference ? String(listing.reference) : null;
    const month = monthKey(lead?.createdAt) || 'unknown';

    const bump = (m, key) => {
      if (!key) return;
      if (!m.has(key)) m.set(key, { total: 0, byMonth: {} });
      const row = m.get(key);
      row.total += 1;
      row.byMonth[month] = (row.byMonth[month] || 0) + 1;
    };

    bump(byListingId, lid);
    bump(byListingRef, ref);
  }

  return { byListingId, byListingRef };
}

function buildProjectLeadMaps(leads) {
  const byProjectId = new Map();
  let unattributed = 0;

  for (const lead of leads) {
    if (lead?.entityType !== 'project' && !lead?.project?.id) continue;
    const pid = lead?.project?.id ? String(lead.project.id) : null;
    const month = monthKey(lead?.createdAt) || 'unknown';

    if (!pid) {
      unattributed += 1;
      continue;
    }

    if (!byProjectId.has(pid)) byProjectId.set(pid, { total: 0, byMonth: {} });
    const row = byProjectId.get(pid);
    row.total += 1;
    row.byMonth[month] = (row.byMonth[month] || 0) + 1;
  }

  return { byProjectId, unattributed };
}

function monthlyRowsFromMaps(budgetByMonth, leadsByMonth, crmMatchedByMonth) {
  const months = new Set([
    ...Object.keys(budgetByMonth || {}),
    ...Object.keys(leadsByMonth || {}),
    ...Object.keys(crmMatchedByMonth || {}),
  ]);
  const sorted = Array.from(months).sort((a, b) => b.localeCompare(a));
  return sorted.map((month) => {
    const budgetCredits = toNumber((budgetByMonth || {})[month]);
    const budgetAed = budgetCredits * PF_CREDIT_TO_AED;
    const leads = toNumber((leadsByMonth || {})[month]);
    const crmMatchedLeads = toNumber((crmMatchedByMonth || {})[month]);
    return {
      date: month,
      budget_credits: budgetCredits,
      budget_aed: round2(budgetAed),
      cpl_credits: round2(safeDivide(budgetCredits, leads)),
      cpl_aed: round2(safeDivide(budgetAed, leads)),
      crm_matched_leads: crmMatchedLeads,
      cpl_aed_matched: round2(safeDivide(budgetAed, crmMatchedLeads)),
      leads,
    };
  });
}

function summarize(items, type) {
  let listings = 0;
  let budgetCredits = 0;
  let leads = 0;
  let crmMatchedLeads = 0;

  for (const item of items) {
    listings += 1;
    budgetCredits += toNumber(item.totals?.budget_credits);
    leads += toNumber(item.totals?.leads);
    crmMatchedLeads += toNumber(item.totals?.crm_matched_leads);
  }

  return {
    type,
    listings,
    budget_credits: budgetCredits,
    budget_aed: round2(budgetCredits * PF_CREDIT_TO_AED),
    cpl_credits: round2(safeDivide(budgetCredits, leads)),
    cpl_aed: round2(safeDivide(budgetCredits * PF_CREDIT_TO_AED, leads)),
    crm_matched_leads: crmMatchedLeads,
    cpl_aed_matched: round2(safeDivide(budgetCredits * PF_CREDIT_TO_AED, crmMatchedLeads)),
    leads,
  };
}

function buildTableRowsForColumns(rows) {
  // Aggregate by date: count unique listings, sum budget/leads, calculate CPL
  const byDate = {};
  for (const row of rows || []) {
    for (const m of row.monthly || []) {
      const date = m.date || 'unknown';
      if (!byDate[date]) {
        byDate[date] = { listings_set: new Set(), budget_aed: 0, leads: 0, crm_matched_leads: 0 };
      }
      byDate[date].listings_set.add(row.reference || row.listing_id);
      byDate[date].budget_aed += toNumber(m.budget_aed);
      byDate[date].leads += toNumber(m.leads);
      byDate[date].crm_matched_leads += toNumber(m.crm_matched_leads);
    }
  }

  const out = Object.entries(byDate)
    .map(([date, v]) => ({
      listings: v.listings_set.size,
      budget: round2(v.budget_aed),
      date,
      cpl: round2(safeDivide(v.budget_aed, v.leads)),
      cpl_pf: round2(safeDivide(v.budget_aed, v.leads)),
      crm_matched_leads: v.crm_matched_leads,
      cpl_crm_matched: round2(safeDivide(v.budget_aed, v.crm_matched_leads)),
      leads: v.leads,
      leads_pf_total: v.leads,
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return out;
}

function aggregateLeadKinds(leads) {
  const out = { listing: 0, project: 0, agent: 0, company: 0, other: 0 };
  for (const lead of leads) {
    const t = String(lead?.entityType || '').toLowerCase();
    if (t === 'listing') out.listing += 1;
    else if (t === 'project') out.project += 1;
    else if (t === 'agent') out.agent += 1;
    else if (t === 'company') out.company += 1;
    else out.other += 1;
  }
  return out;
}

function buildListingTypeMaps(listingsByType) {
  const byId = new Map();
  const byRef = new Map();

  for (const [type, rows] of Object.entries(listingsByType || {})) {
    for (const row of rows || []) {
      const id = row?.id ? String(row.id) : null;
      const ref = row?.reference ? String(row.reference) : null;
      if (id) byId.set(id, type);
      if (ref) byRef.set(ref, type);
    }
  }

  return { byId, byRef };
}

function mapCategoryPairToType(category, offeringType) {
  const c = String(category || '').toLowerCase();
  const o = String(offeringType || '').toLowerCase();

  if (c === 'residential' && o === 'sale') return 'Sell';
  if (c === 'residential' && (o === 'rent' || o === 'yearly')) return 'Rent';
  if (c === 'commercial' && o === 'sale') return 'Commercial Sell';
  if (c === 'commercial' && (o === 'rent' || o === 'yearly')) return 'Commercial Rent';
  return null;
}

function buildWeightMap(confirmedCounts, keys) {
  const weights = {};
  let total = 0;
  for (const key of keys) {
    total += toNumber(confirmedCounts[key]);
  }

  if (total <= 0) {
    const equal = 1 / keys.length;
    for (const key of keys) weights[key] = equal;
    return weights;
  }

  for (const key of keys) {
    weights[key] = toNumber(confirmedCounts[key]) / total;
  }
  return weights;
}

function allocateIntegerByWeights(total, weights, keys) {
  const allocations = {};
  for (const key of keys) allocations[key] = 0;

  const count = toNumber(total);
  if (count <= 0) return allocations;

  const raw = keys.map((key) => {
    const exact = count * toNumber(weights[key]);
    const base = Math.floor(exact);
    return { key, exact, base, remainder: exact - base };
  });

  let assigned = 0;
  for (const row of raw) {
    allocations[row.key] = row.base;
    assigned += row.base;
  }

  let left = count - assigned;
  raw.sort((a, b) => b.remainder - a.remainder);
  let idx = 0;
  while (left > 0 && raw.length > 0) {
    allocations[raw[idx % raw.length].key] += 1;
    left -= 1;
    idx += 1;
  }

  return allocations;
}

function buildDualKPI(leads, listingTypeById, listingTypeByRef) {
  const categories = ['Sell', 'Rent', 'Commercial Sell', 'Commercial Rent'];

  const confirmed = { Sell: 0, Rent: 0, 'Commercial Sell': 0, 'Commercial Rent': 0 };
  const inferred = { Sell: 0, Rent: 0, 'Commercial Sell': 0, 'Commercial Rent': 0 };
  const inferredReasonTotals = {
    listing_payload_category_offering: 0,
    project_proportional: 0,
    no_listing_pointer_proportional: 0,
    listing_pointer_out_of_scope_proportional: 0,
  };

  const deferred = {
    project: 0,
    noPointer: 0,
    listingOutOfScope: 0,
  };

  for (const lead of leads || []) {
    const lid = lead?.listing?.id ? String(lead.listing.id) : null;
    const ref = lead?.listing?.reference ? String(lead.listing.reference) : null;
    const entityType = String(lead?.entityType || '').toLowerCase();

    const directType = (lid && listingTypeById.get(lid)) || (ref && listingTypeByRef.get(ref)) || null;
    if (directType && categories.includes(directType)) {
      confirmed[directType] += 1;
      continue;
    }

    const payloadCategory = lead?.listing?.category || null;
    const payloadOfferingType =
      lead?.listing?.offeringType ||
      lead?.listing?.price?.type ||
      lead?.listing?.priceType ||
      null;
    const payloadType = mapCategoryPairToType(payloadCategory, payloadOfferingType);
    if (payloadType && categories.includes(payloadType)) {
      inferred[payloadType] += 1;
      inferredReasonTotals.listing_payload_category_offering += 1;
      continue;
    }

    if (entityType === 'project') {
      deferred.project += 1;
      continue;
    }

    if (!lid && !ref) {
      deferred.noPointer += 1;
      continue;
    }

    deferred.listingOutOfScope += 1;
  }

  const weights = buildWeightMap(confirmed, categories);

  const projectAlloc = allocateIntegerByWeights(deferred.project, weights, categories);
  const noPointerAlloc = allocateIntegerByWeights(deferred.noPointer, weights, categories);
  const outOfScopeAlloc = allocateIntegerByWeights(deferred.listingOutOfScope, weights, categories);

  for (const key of categories) {
    inferred[key] += toNumber(projectAlloc[key]);
    inferred[key] += toNumber(noPointerAlloc[key]);
    inferred[key] += toNumber(outOfScopeAlloc[key]);
  }

  inferredReasonTotals.project_proportional = deferred.project;
  inferredReasonTotals.no_listing_pointer_proportional = deferred.noPointer;
  inferredReasonTotals.listing_pointer_out_of_scope_proportional = deferred.listingOutOfScope;

  const byCategory = {};
  for (const key of categories) {
    byCategory[key] = {
      confirmed: toNumber(confirmed[key]),
      modeled_inferred: toNumber(inferred[key]),
      modeled_total: toNumber(confirmed[key]) + toNumber(inferred[key]),
    };
  }

  return {
    categories,
    byCategory,
    totals: {
      confirmed_total: categories.reduce((acc, key) => acc + toNumber(confirmed[key]), 0),
      modeled_inferred_total: categories.reduce((acc, key) => acc + toNumber(inferred[key]), 0),
      modeled_total: categories.reduce((acc, key) => acc + toNumber(confirmed[key]) + toNumber(inferred[key]), 0),
      all_pf_leads: toNumber((leads || []).length),
    },
    confidence_breakdown: {
      A_direct_listing_match_confirmed: categories.reduce((acc, key) => acc + toNumber(confirmed[key]), 0),
      B_listing_payload_category_offering: inferredReasonTotals.listing_payload_category_offering,
      C_project_proportional: inferredReasonTotals.project_proportional,
      D_no_listing_pointer_proportional: inferredReasonTotals.no_listing_pointer_proportional,
      D_listing_pointer_out_of_scope_proportional: inferredReasonTotals.listing_pointer_out_of_scope_proportional,
    },
    allocation_weights_from_confirmed: weights,
  };
}

function buildLeadsByMonth(leads) {
  const byMonth = {};
  for (const lead of leads || []) {
    const month = monthKey(lead?.createdAt) || 'unknown';
    byMonth[month] = (byMonth[month] || 0) + 1;
  }
  return byMonth;
}

function buildAssignedLeadsByMonth(rows) {
  const byMonth = {};
  for (const row of rows || []) {
    for (const m of row.monthly || []) {
      const month = m.date || 'unknown';
      byMonth[month] = (byMonth[month] || 0) + toNumber(m.leads);
    }
  }
  return byMonth;
}

function buildOtherBudgetFromCredits(transactions, includedRefsSet) {
  const byMonth = {};
  let totalCredits = 0;
  let outOfScopeRefCredits = 0;
  let noListingRefCredits = 0;

  for (const tx of transactions || []) {
    const action = tx?.transactionInfo?.action;
    const type = tx?.transactionInfo?.type;
    if (!(action === 'charge' && type === 'credits')) continue;

    const amount = Math.abs(toNumber(tx?.transactionInfo?.amount));
    const month = monthKey(tx?.createdAt) || 'unknown';
    const ref = normalizeListingRef(tx?.listingInfo?.reference);

    if (ref && includedRefsSet.has(ref)) continue;

    totalCredits += amount;
    byMonth[month] = (byMonth[month] || 0) + amount;

    if (ref) outOfScopeRefCredits += amount;
    else noListingRefCredits += amount;
  }

  return { totalCredits, byMonth, outOfScopeRefCredits, noListingRefCredits };
}

function buildOtherCrmMatchedByMonth(crmMatchedByRef, includedRefsSet) {
  const byMonth = {};
  let total = 0;

  for (const [ref, agg] of crmMatchedByRef.entries()) {
    if (includedRefsSet.has(ref)) continue;
    total += toNumber(agg?.total);
    for (const [month, count] of Object.entries(agg?.byMonth || {})) {
      byMonth[month] = (byMonth[month] || 0) + toNumber(count);
    }
  }

  return { total, byMonth };
}

function buildOtherReportRows(otherBudgetByMonth, otherLeadsByMonth, otherCrmByMonth) {
  const months = new Set([
    ...Object.keys(otherBudgetByMonth || {}),
    ...Object.keys(otherLeadsByMonth || {}),
    ...Object.keys(otherCrmByMonth || {}),
  ]);

  return Array.from(months)
    .sort((a, b) => String(b).localeCompare(String(a)))
    .map((month) => {
      const budgetCredits = toNumber(otherBudgetByMonth[month]);
      const budgetAed = round2(budgetCredits * PF_CREDIT_TO_AED);
      const leads = toNumber(otherLeadsByMonth[month]);
      const crmMatchedLeads = toNumber(otherCrmByMonth[month]);
      return {
        listings: 0,
        budget: budgetAed,
        date: month,
        cpl: round2(safeDivide(budgetAed, leads)),
        cpl_pf: round2(safeDivide(budgetAed, leads)),
        crm_matched_leads: crmMatchedLeads,
        cpl_crm_matched: round2(safeDivide(budgetAed, crmMatchedLeads)),
        leads: leads,
        leads_pf_total: leads,
      };
    });
}

async function main() {
  const startedAt = new Date();
  const token = await getToken();

  const [listingsByType, credits, leads, crmMatched] = await Promise.all([
    fetchAllListings(token),
    fetchAllCreditsTransactions(token),
    fetchAllLeads(token),
    fetchCrmMatchedLeadMaps(),
  ]);

  const { byId: listingTypeById, byRef: listingTypeByRef } = buildListingTypeMaps(listingsByType);
  const dualKpi = buildDualKPI(leads, listingTypeById, listingTypeByRef);

  const listingBudgetByRef = buildListingBudgetMaps(credits);
  const crmMatchedByRef = crmMatched.byListingRef || new Map();
  const projectBudgetById = buildProjectBudgetMaps(credits);
  const { byListingId, byListingRef } = buildListingLeadMaps(leads);
  const { byProjectId, unattributed: projectLeadsWithoutProjectId } = buildProjectLeadMaps(leads);

  const projectIds = new Set(byProjectId.keys());
  const projectDetails = await fetchProjectDetails(projectIds, token);

  const buildListingRows = (types) => {
    const out = [];

    for (const type of types) {
      const rows = listingsByType[type] || [];
      for (const listing of rows) {
        const listingId = listing?.id ? String(listing.id) : null;
        const reference = listing?.reference ? String(listing.reference) : null;

        const leadAgg =
          (listingId && byListingId.get(listingId)) ||
          (reference && byListingRef.get(reference)) ||
          { total: 0, byMonth: {} };

        const budgetAgg = (reference && listingBudgetByRef.get(reference)) || { totalCredits: 0, byMonth: {} };
        const crmAgg = crmMatchedByRef.get(normalizeListingRef(reference)) || { total: 0, byMonth: {} };
        const monthly = monthlyRowsFromMaps(budgetAgg.byMonth, leadAgg.byMonth, crmAgg.byMonth);

        out.push({
          listing_id: listingId,
          reference,
          title: listing?.title?.en || reference || listingId,
          status: listing?.__state || listing?.state || null,
          category: listing?.__category || null,
          offering_type: listing?.__offeringType || null,
          group: listing?.__group || null,
          type,
          totals: {
            budget_credits: toNumber(budgetAgg.totalCredits),
            budget_aed: round2(toNumber(budgetAgg.totalCredits) * PF_CREDIT_TO_AED),
            cpl_credits: round2(safeDivide(toNumber(budgetAgg.totalCredits), toNumber(leadAgg.total))),
            cpl_aed: round2(safeDivide(toNumber(budgetAgg.totalCredits) * PF_CREDIT_TO_AED, toNumber(leadAgg.total))),
            crm_matched_leads: toNumber(crmAgg.total),
            cpl_aed_matched: round2(safeDivide(toNumber(budgetAgg.totalCredits) * PF_CREDIT_TO_AED, toNumber(crmAgg.total))),
            leads: toNumber(leadAgg.total),
          },
          monthly,
          payload: listing,
        });
      }
    }

    return out;
  };

  const ourRows = buildListingRows(['Sell', 'Rent']);
  const partnerRows = buildListingRows(['Commercial Sell', 'Commercial Rent']);

  const includedRefsSet = new Set(
    [...ourRows, ...partnerRows]
      .map((r) => normalizeListingRef(r.reference))
      .filter(Boolean),
  );

  const allLeadsByMonth = buildLeadsByMonth(leads);
  const assignedLeadsByMonth = buildAssignedLeadsByMonth([...ourRows, ...partnerRows]);
  const otherLeadsByMonth = {};
  const leadMonths = new Set([...Object.keys(allLeadsByMonth), ...Object.keys(assignedLeadsByMonth)]);
  for (const month of leadMonths) {
    otherLeadsByMonth[month] = Math.max(0, toNumber(allLeadsByMonth[month]) - toNumber(assignedLeadsByMonth[month]));
  }

  const otherBudgetAgg = buildOtherBudgetFromCredits(credits, includedRefsSet);
  const otherCrmAgg = buildOtherCrmMatchedByMonth(crmMatchedByRef, includedRefsSet);
  const otherReportRows = buildOtherReportRows(otherBudgetAgg.byMonth, otherLeadsByMonth, otherCrmAgg.byMonth);

  const otherTotals = {
    type: 'Other (Unallocated)',
    listings: 0,
    budget_credits: round2(otherBudgetAgg.totalCredits),
    budget_aed: round2(otherBudgetAgg.totalCredits * PF_CREDIT_TO_AED),
    cpl_credits: round2(safeDivide(otherBudgetAgg.totalCredits, Object.values(otherLeadsByMonth).reduce((a, b) => a + toNumber(b), 0))),
    cpl_aed: round2(safeDivide(otherBudgetAgg.totalCredits * PF_CREDIT_TO_AED, Object.values(otherLeadsByMonth).reduce((a, b) => a + toNumber(b), 0))),
    crm_matched_leads: toNumber(otherCrmAgg.total),
    cpl_aed_matched: round2(safeDivide(otherBudgetAgg.totalCredits * PF_CREDIT_TO_AED, otherCrmAgg.total)),
    leads: Object.values(otherLeadsByMonth).reduce((a, b) => a + toNumber(b), 0),
  };

  const primaryPlusRows = [];
  for (const [projectId, leadAgg] of byProjectId.entries()) {
    const detail = projectDetails.get(projectId) || {};
    const district = detail?.location?.name?.en || detail?.location?.name?.ar || 'Unknown District';
    const title = detail?.name?.en || detail?.name?.ar || detail?.reference || `Project ${projectId}`;
    const reference = detail?.reference || null;

    const budgetAgg = projectBudgetById.get(projectId) || { totalCredits: 0, byMonth: {} };
    const monthly = monthlyRowsFromMaps(budgetAgg.byMonth, leadAgg.byMonth);

    primaryPlusRows.push({
      project_id: projectId,
      reference,
      title,
      district,
      totals: {
        budget_credits: toNumber(budgetAgg.totalCredits),
        budget_aed: round2(toNumber(budgetAgg.totalCredits) * PF_CREDIT_TO_AED),
        cpl_credits: round2(safeDivide(toNumber(budgetAgg.totalCredits), toNumber(leadAgg.total))),
        cpl_aed: round2(safeDivide(toNumber(budgetAgg.totalCredits) * PF_CREDIT_TO_AED, toNumber(leadAgg.total))),
        leads: toNumber(leadAgg.total),
      },
      monthly,
      payload: detail,
    });
  }

  primaryPlusRows.sort((a, b) => {
    if (a.district !== b.district) return a.district.localeCompare(b.district);
    return a.title.localeCompare(b.title);
  });

  const output = {
    meta: {
      generated_at: new Date().toISOString(),
      script: 'scripts/pf_export_full_json.mjs',
      source: 'Property Finder Atlas API v1',
      listing_states_used: LISTING_STATES,
      credits_transactions_filter: { type: PF_CREDITS_TX_TYPE },
      credit_to_aed_rate: PF_CREDIT_TO_AED,
    },
    diagnostics: {
      api_totals: {
        listings_total: ourRows.length + partnerRows.length,
        credits_transactions_total: credits.length,
        leads_unfiltered_total: leads.length,
        lead_entity_breakdown: aggregateLeadKinds(leads),
        project_ids_from_leads_total: projectIds.size,
        project_details_loaded_total: Array.from(projectDetails.values()).filter(Boolean).length,
        project_leads_without_project_id: projectLeadsWithoutProjectId,
      },
      allocation_coverage: {
        listed_tables_leads_total: summarize(ourRows, 'all').leads + summarize(partnerRows, 'all').leads,
        other_unallocated_leads_total: otherTotals.leads,
        listed_tables_budget_credits_total: summarize(ourRows, 'all').budget_credits + summarize(partnerRows, 'all').budget_credits,
        other_unallocated_budget_credits_total: otherTotals.budget_credits,
        other_budget_breakdown_credits: {
          listing_ref_out_of_scope: round2(otherBudgetAgg.outOfScopeRefCredits),
          no_listing_ref_in_transaction: round2(otherBudgetAgg.noListingRefCredits),
        },
      },
      crm_matching: {
        source_view: `${BQ_PROJECT_ID}.${BQ_DATASET_ID}.${BQ_PF_EFFICACY_VIEW}`,
        available: !!crmMatched.available,
        total_pf_rows: toNumber(crmMatched?.stats?.total_pf_rows),
        matched_pf_rows: toNumber(crmMatched?.stats?.matched_pf_rows),
        last_pf_created_at: crmMatched?.stats?.last_pf_created_at || null,
        error: crmMatched?.available ? null : crmMatched?.error || 'unknown',
      },
      dual_kpi_4_categories: dualKpi,
      note: 'leads_unfiltered_total includes listing/project/agent/company/other leads from PF API.',
    },
    tables: {
      property_finder_listings_performance_our: {
        title: 'Property Finder Listings Performance - Our',
        channel: 'PROPERTY FINDER',
        schema: {
          sections: ['Sell', 'Rent'],
          columns: ['Listings', 'Budget', 'Date', 'CPL (PF)', 'Leads (PF total)', 'CRM Matched Leads', 'CPL (CRM Matched)'],
          row_fields: ['listing_id', 'reference', 'title', 'status', 'category', 'offering_type', 'group', 'totals', 'monthly'],
          filterable_fields: ['date'],
        },
        totals: {
          sell: summarize(ourRows.filter((r) => r.type === 'Sell'), 'Sell'),
          rent: summarize(ourRows.filter((r) => r.type === 'Rent'), 'Rent'),
          all: summarize(ourRows, 'All'),
        },
        report_rows: buildTableRowsForColumns(ourRows),
        rows: ourRows,
      },
      property_finder_listings_performance_partner: {
        title: 'Property Finder Listings Performance - Partner',
        channel: 'PROPERTY FINDER',
        schema: {
          sections: ['Commercial Sell', 'Commercial Rent'],
          columns: ['Listings', 'Budget', 'Date', 'CPL (PF)', 'Leads (PF total)', 'CRM Matched Leads', 'CPL (CRM Matched)'],
          row_fields: ['listing_id', 'reference', 'title', 'status', 'category', 'offering_type', 'group', 'totals', 'monthly'],
          filterable_fields: ['date'],
        },
        totals: {
          commercial_sell: summarize(partnerRows.filter((r) => r.type === 'Commercial Sell'), 'Commercial Sell'),
          commercial_rent: summarize(partnerRows.filter((r) => r.type === 'Commercial Rent'), 'Commercial Rent'),
          all: summarize(partnerRows, 'All'),
        },
        report_rows: buildTableRowsForColumns(partnerRows),
        rows: partnerRows,
      },
      property_finder_listings_performance_other_unallocated: {
        title: 'Property Finder Listings Performance - Other (Unallocated)',
        channel: 'PROPERTY FINDER',
        schema: {
          sections: ['Other (Unallocated)'],
          columns: ['Listings', 'Budget', 'Date', 'CPL (PF)', 'Leads (PF total)', 'CRM Matched Leads', 'CPL (CRM Matched)'],
          row_fields: ['totals', 'report_rows'],
          filterable_fields: ['date'],
        },
        totals: { all: otherTotals },
        report_rows: otherReportRows,
        rows: [],
      },
      property_finder_primary_plus_by_districts: {
        title: 'Property Finder Primary Plus (By Districts)',
        channel: 'Primary Plus',
        scope: 'All leads',
        schema: {
          sections: ['All leads'],
          columns: ['Budget', 'Date', 'Leads'],
          row_fields: ['project_id', 'reference', 'title', 'district', 'totals', 'monthly'],
        },
        totals: {
          projects: primaryPlusRows.length,
          budget_credits: primaryPlusRows.reduce((acc, r) => acc + toNumber(r.totals.budget_credits), 0),
          budget_aed: primaryPlusRows.reduce((acc, r) => acc + toNumber(r.totals.budget_aed), 0),
          leads: primaryPlusRows.reduce((acc, r) => acc + toNumber(r.totals.leads), 0),
        },
        rows: primaryPlusRows,
      },
    },
  };

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(process.cwd(), 'data', 'exports');
  await fs.mkdir(outDir, { recursive: true });

  const latestPath = path.join(outDir, 'pf_full_export_latest.json');
  const datedPath = path.join(outDir, `pf_full_export_${ts}.json`);

  const text = JSON.stringify(output, null, 2);
  await fs.writeFile(latestPath, text, 'utf8');
  await fs.writeFile(datedPath, text, 'utf8');

  const elapsedSec = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1);
  console.log(`OK: exported PF full JSON`);
  console.log(`- ${latestPath}`);
  console.log(`- ${datedPath}`);
  console.log(`- listings: ${output.diagnostics.api_totals.listings_total}`);
  console.log(`- leads_unfiltered_total: ${output.diagnostics.api_totals.leads_unfiltered_total}`);
  console.log(`- primary_plus_projects: ${output.tables.property_finder_primary_plus_by_districts.totals.projects}`);
  console.log(`- elapsed_sec: ${elapsedSec}`);
}

main().catch((err) => {
  console.error('FAILED:', err?.message || err);
  process.exit(1);
});
