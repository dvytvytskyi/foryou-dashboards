import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const API_URL = 'https://atlas.propertyfinder.com/v1';
const PF_CREDIT_TO_AED = 1327;
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
  return fetchPaginated((page) => `${API_URL}/credits/transactions?perPage=50&page=${page}`, token);
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

function monthlyRowsFromMaps(budgetByMonth, leadsByMonth) {
  const months = new Set([...Object.keys(budgetByMonth || {}), ...Object.keys(leadsByMonth || {})]);
  const sorted = Array.from(months).sort((a, b) => b.localeCompare(a));
  return sorted.map((month) => {
    const budgetCredits = toNumber((budgetByMonth || {})[month]);
    const leads = toNumber((leadsByMonth || {})[month]);
    return {
      date: month,
      budget_credits: budgetCredits,
      budget_aed: budgetCredits * PF_CREDIT_TO_AED,
      leads,
    };
  });
}

function summarize(items, type) {
  let listings = 0;
  let budgetCredits = 0;
  let leads = 0;

  for (const item of items) {
    listings += 1;
    budgetCredits += toNumber(item.totals?.budget_credits);
    leads += toNumber(item.totals?.leads);
  }

  return {
    type,
    listings,
    budget_credits: budgetCredits,
    budget_aed: budgetCredits * PF_CREDIT_TO_AED,
    leads,
  };
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

async function main() {
  const startedAt = new Date();
  const token = await getToken();

  const [listingsByType, credits, leads] = await Promise.all([
    fetchAllListings(token),
    fetchAllCreditsTransactions(token),
    fetchAllLeads(token),
  ]);

  const listingBudgetByRef = buildListingBudgetMaps(credits);
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
        const monthly = monthlyRowsFromMaps(budgetAgg.byMonth, leadAgg.byMonth);

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
            budget_aed: toNumber(budgetAgg.totalCredits) * PF_CREDIT_TO_AED,
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
        budget_aed: toNumber(budgetAgg.totalCredits) * PF_CREDIT_TO_AED,
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
      note: 'leads_unfiltered_total includes listing/project/agent/company/other leads from PF API.',
    },
    tables: {
      property_finder_listings_performance_our: {
        title: 'Property Finder Listings Performance - Our',
        channel: 'PROPERTY FINDER',
        schema: {
          sections: ['Sell', 'Rent'],
          columns: ['Budget', 'Date', 'Leads'],
          row_fields: ['listing_id', 'reference', 'title', 'status', 'category', 'offering_type', 'group', 'totals', 'monthly'],
        },
        totals: {
          sell: summarize(ourRows.filter((r) => r.type === 'Sell'), 'Sell'),
          rent: summarize(ourRows.filter((r) => r.type === 'Rent'), 'Rent'),
          all: summarize(ourRows, 'All'),
        },
        rows: ourRows,
      },
      property_finder_listings_performance_partner: {
        title: 'Property Finder Listings Performance - Partner',
        channel: 'PROPERTY FINDER',
        schema: {
          sections: ['Commercial Sell', 'Commercial Rent'],
          columns: ['Budget', 'Date', 'Leads'],
          row_fields: ['listing_id', 'reference', 'title', 'status', 'category', 'offering_type', 'group', 'totals', 'monthly'],
        },
        totals: {
          commercial_sell: summarize(partnerRows.filter((r) => r.type === 'Commercial Sell'), 'Commercial Sell'),
          commercial_rent: summarize(partnerRows.filter((r) => r.type === 'Commercial Rent'), 'Commercial Rent'),
          all: summarize(partnerRows, 'All'),
        },
        rows: partnerRows,
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
