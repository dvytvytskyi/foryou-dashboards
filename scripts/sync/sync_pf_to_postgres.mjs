import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = 'https://atlas.propertyfinder.com/v1';
const PF_CREDITS_TX_TYPE = 'credits';
const EXCLUDED_GROUPS = new Set(['Partner', 'AbuDhabi']);

// Load broker permits mapping (full details)
let brokerPermitsList = [];
try {
  const mapPath = path.resolve(__dirname, '../../pf_broker_permits_mapping.json');
  if (fs.existsSync(mapPath)) {
    brokerPermitsList = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    console.log(`[INIT] Loaded broker permits mapping: ${brokerPermitsList.length} permits`);
  }
} catch (err) {
  console.warn('[WARN] Could not load broker permits mapping:', err.message);
}

// Pre-build fast lookup map from broker permits list
const _permitLookup = {};
for (const entry of brokerPermitsList) {
  if (!entry.permit || entry.groupName === 'Unknown') continue;
  const p = entry.permit;
  // exact key
  _permitLookup[p] = entry.groupName;
  // strip leading zeros variation
  const stripped = p.replace(/^0+/, '');
  if (stripped && stripped !== p) {
    _permitLookup[stripped] = entry.groupName;
    // for-you-real-estate prefix
    _permitLookup[`for-you-real-estate-${stripped}`] = entry.groupName;
  }
  // 13xxxxxxxx format → also as for-you-real-estate-13xxxxxxxx
  if (/^13\d{5,}$/.test(p)) {
    _permitLookup[`for-you-real-estate-${p}`] = entry.groupName;
  }
}

function getGroupNameForListing(listing) {
  if (!listing.reference) return null;

  const ref = String(listing.reference).trim();

  // Format 1: direct match
  if (_permitLookup[ref]) return _permitLookup[ref];

  // Format 2: strip leading zeros from ref and try
  const refStripped = ref.replace(/^for-you-real-estate-/, '').replace(/^0+/, '');
  if (refStripped && _permitLookup[refStripped]) return _permitLookup[refStripped];

  // Format 3: add leading zeros to numeric ref
  if (/^\d+$/.test(ref)) {
    for (let len = ref.length + 1; len <= 10; len++) {
      const padded = ref.padStart(len, '0');
      if (_permitLookup[padded]) return _permitLookup[padded];
    }
  }

  return null; // no match
}

const CATEGORIES = [
  { name: 'Sell', category: 'residential', offeringType: 'sale', groupName: 'Our' },
  { name: 'Rent', category: 'residential', offeringType: 'rent', groupName: 'Our' },
  { name: 'Commercial Sell', category: 'commercial', offeringType: 'sale', groupName: 'Our' },
  { name: 'Commercial Rent', category: 'commercial', offeringType: 'rent', groupName: 'Our' },
];

function getConnectionString() {
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;

  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DB;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const sslMode = (process.env.POSTGRES_SSL_MODE || 'require').toLowerCase();

  if (!host || !database || !user || !password) {
    throw new Error('Missing PostgreSQL env. Set POSTGRES_URL or POSTGRES_HOST/PORT/DB/USER/PASSWORD');
  }

  const sslPart = sslMode === 'disable' ? '' : '?sslmode=require';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}${sslPart}`;
}

async function getToken() {
  const apiKey = process.env.PF_API_KEY;
  const apiSecret = process.env.PF_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Missing PF_API_KEY or PF_API_SECRET');
  }

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
    throw new Error(`PF token error: ${JSON.stringify(data)}`);
  }
  return data.accessToken;
}

async function fetchAllListings(category, offeringType, state, token) {
  let page = 1;
  let all = [];

  while (true) {
    const url = `${API_URL}/listings?filter[category]=${category}&filter[offeringType]=${offeringType}&filter[state]=${state}&perPage=50&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();

    if (!res.ok) throw new Error(`PF listings fetch failed: ${JSON.stringify(data)}`);

    const rows = data.results || [];
    if (!rows.length) break;

    all = all.concat(rows);
    if (!data.pagination?.nextPage) break;
    page = data.pagination.nextPage;
  }

  return all;
}

async function fetchCreditsTransactions(token) {
  let page = 1;
  let txs = [];

  while (true) {
    const res = await fetch(`${API_URL}/credits/transactions?type=${encodeURIComponent(PF_CREDITS_TX_TYPE)}&perPage=50&page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`PF credits fetch failed: ${JSON.stringify(data)}`);

    const rows = data.data || [];
    if (!rows.length) break;

    txs = txs.concat(rows);
    if (!data.pagination?.nextPage) break;
    page = data.pagination.nextPage;
  }

  return txs;
}

async function fetchAllLeads(token) {
  let page = 1;
  const leads = [];

  while (true) {
    const res = await fetch(`${API_URL}/leads?perPage=50&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(`PF leads fetch failed: ${JSON.stringify(data)}`);
    }

    const rows = data.data || data.results || [];
    if (!rows.length) break;

    leads.push(...rows);
    if (!data.pagination?.nextPage) break;
    page = data.pagination.nextPage;
    if (page > 2000) break;
  }

  return leads;
}

async function fetchProjectDetails(projectIds, token) {
  const out = new Map();
  const ids = Array.from(projectIds || []).map((id) => String(id)).filter(Boolean);

  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    const rows = await Promise.all(
      chunk.map(async (id) => {
        try {
          const res = await fetch(`${API_URL}/projects/${encodeURIComponent(id)}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          });
          if (!res.ok) return [id, null];
          const data = await res.json();
          return [id, data];
        } catch {
          return [id, null];
        }
      }),
    );

    for (const [id, data] of rows) {
      out.set(id, data);
    }
  }

  return out;
}

function buildListingLeadMaps(leads) {
  const byListingId = new Map();
  const byListingRef = new Map();
  const detailsByKey = new Map();
  let listingWithoutKeyCount = 0;

  for (const lead of leads) {
    const entityType = String(lead?.entityType || '').toLowerCase();
    const listingId = lead?.listing?.id ? String(lead.listing.id) : null;
    const listingRef = lead?.listing?.reference ? String(lead.listing.reference) : null;
    if (!listingId && !listingRef) {
      if (entityType === 'listing') {
        listingWithoutKeyCount += 1;
      }
      continue;
    }

    const key = listingId || `ref:${listingRef}`;
    if (!detailsByKey.has(key)) {
      detailsByKey.set(key, {
        listingId,
        listingRef,
        count: 0,
        byMonth: {},
        sample: lead,
      });
    }
    const month = String(lead?.createdAt || '').slice(0, 7);
    detailsByKey.get(key).count += 1;
    if (month) {
      detailsByKey.get(key).byMonth[month] = (detailsByKey.get(key).byMonth[month] || 0) + 1;
    }

    if (listingId) {
      if (!byListingId.has(listingId)) byListingId.set(listingId, { total: 0, byMonth: {} });
      const row = byListingId.get(listingId);
      row.total += 1;
      if (month) row.byMonth[month] = (row.byMonth[month] || 0) + 1;
    }
    if (listingRef) {
      if (!byListingRef.has(listingRef)) byListingRef.set(listingRef, { total: 0, byMonth: {} });
      const row = byListingRef.get(listingRef);
      row.total += 1;
      if (month) row.byMonth[month] = (row.byMonth[month] || 0) + 1;
    }
  }

  return { byListingId, byListingRef, detailsByKey, listingWithoutKeyCount };
}

function normalizeListingRef(value) {
  const ref = String(value || '').trim();
  if (!ref || ref === '-') return null;
  return ref.replace(/\/+$/, '');
}

function monthFromSyncPayload(payload, syncedAt) {
  const monthDirect = String(payload?.created_month || '').trim();
  if (/^\d{4}-\d{2}$/.test(monthDirect)) return monthDirect;

  const createdAtIso = String(payload?.createdAt || payload?.created_at_iso || '').trim();
  if (createdAtIso.length >= 7) {
    const monthIso = createdAtIso.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(monthIso)) return monthIso;
  }

  const createdAtUnix = Number(payload?.created_at || 0);
  if (Number.isFinite(createdAtUnix) && createdAtUnix > 0) {
    return new Date(createdAtUnix * 1000).toISOString().slice(0, 7);
  }

  if (syncedAt) {
    const fallback = String(syncedAt).slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(fallback)) return fallback;
  }

  return null;
}

async function loadOurListingLeadsFromSyncState(client) {
  const { rows } = await client.query(
    `
      SELECT payload, synced_at
      FROM pf_amo_sync_state
      WHERE amo_lead_id IS NOT NULL
    `,
  );

  const byRef = new Map();
  const noRefByMonth = {};
  let noRefTotal = 0;
  let noRefRows = 0;

  for (const row of rows) {
    const payload = row?.payload || {};
    const ref = normalizeListingRef(payload?.pf_listing_ref || payload?.listingRef || payload?.listing_ref || '');
    const leadWeight = Math.max(1, Number(payload?.duplicate_count || 1));

    const month = monthFromSyncPayload(payload, row?.synced_at);

    if (!ref) {
      noRefTotal += leadWeight;
      noRefRows += leadWeight;
      if (month) noRefByMonth[month] = (noRefByMonth[month] || 0) + leadWeight;
      continue;
    }

    if (!byRef.has(ref)) {
      byRef.set(ref, { total: 0, byMonth: {} });
    }
    const agg = byRef.get(ref);
    agg.total += leadWeight;
    if (month) agg.byMonth[month] = (agg.byMonth[month] || 0) + leadWeight;
  }

  return { byRef, noRefTotal, noRefByMonth, noRefRows };
}

function aggregateCredits(txs) {
  const byReferenceTotal = {};
  const byReferenceMonth = {};
  let unassignedTotal = 0;
  const unassignedByMonth = {};

  for (const tx of txs) {
    const isChargeCredits = tx.transactionInfo?.action === 'charge' && tx.transactionInfo?.type === 'credits';
    if (!isChargeCredits) continue;

    const amount = Math.abs(Number(tx.transactionInfo?.amount || 0));
    const month = String(tx.createdAt || '').slice(0, 7);
    const ref = tx.listingInfo?.reference;

    if (!ref) {
      unassignedTotal += amount;
      if (month) unassignedByMonth[month] = (unassignedByMonth[month] || 0) + amount;
      continue;
    }

    byReferenceTotal[ref] = (byReferenceTotal[ref] || 0) + amount;

    if (!byReferenceMonth[ref]) byReferenceMonth[ref] = {};
    byReferenceMonth[ref][month] = (byReferenceMonth[ref][month] || 0) + amount;
  }

  return { byReferenceTotal, byReferenceMonth, unassignedTotal, unassignedByMonth };
}

function aggregateProjectCredits(txs) {
  const byProjectId = new Map();

  for (const tx of txs) {
    const isChargeCredits = tx.transactionInfo?.action === 'charge' && tx.transactionInfo?.type === 'credits';
    if (!isChargeCredits) continue;

    const projectId = tx?.projectInfo?.id ? String(tx.projectInfo.id) : null;
    if (!projectId) continue;

    const amount = Math.abs(Number(tx.transactionInfo?.amount || 0));
    const month = String(tx.createdAt || '').slice(0, 7);

    if (!byProjectId.has(projectId)) {
      byProjectId.set(projectId, { totalCredits: 0, byMonth: {} });
    }

    const row = byProjectId.get(projectId);
    row.totalCredits += amount;
    if (month) row.byMonth[month] = (row.byMonth[month] || 0) + amount;
  }

  return byProjectId;
}

// PF does not expose per-project breakdown for Primary Plus "Ad Campaign" charges.
// We aggregate the total PP budget by month and distribute it proportionally
// among projects based on their leads count in each month.
function aggregatePrimaryPlusBudget(txs) {
  const byMonth = {};
  let total = 0;

  for (const tx of txs) {
    const isCharge = tx.transactionInfo?.action === 'charge' && tx.transactionInfo?.type === 'credits';
    if (!isCharge) continue;
    // Ad Campaign charges with no listing reference = Primary Plus spend
    if (tx.listingInfo?.reference) continue;
    if (tx.description !== 'Ad Campaign') continue;

    const amount = Math.abs(Number(tx.transactionInfo?.amount || 0));
    const month = String(tx.createdAt || '').slice(0, 7);
    total += amount;
    if (month) byMonth[month] = (byMonth[month] || 0) + amount;
  }

  return { total, byMonth };
}

function distributeBudgetByLeads(ppBudget, projects) {
  // ppBudget = { total, byMonth: { 'YYYY-MM': credits } }
  // For each month, distribute credits proportionally by each project's leads that month.
  // Projects that have 0 leads in a given month get 0 budget for that month.
  const result = new Map(); // projectId -> { totalCredits, byMonth }

  for (const project of projects) {
    result.set(String(project.projectId), { totalCredits: 0, byMonth: {} });
  }

  for (const [month, totalCredits] of Object.entries(ppBudget.byMonth)) {
    // Total leads across all projects in this month
    const totalLeads = projects.reduce((sum, p) => sum + Number(p.leadsByMonth?.[month] || 0), 0);
    if (totalLeads === 0) continue;

    for (const project of projects) {
      const projectLeads = Number(project.leadsByMonth?.[month] || 0);
      if (projectLeads === 0) continue;
      const share = (projectLeads / totalLeads) * totalCredits;
      const row = result.get(String(project.projectId));
      row.totalCredits += share;
      row.byMonth[month] = (row.byMonth[month] || 0) + share;
    }
  }

  return result;
}

async function upsertListing(client, row) {
  await client.query(`ALTER TABLE pf_listings_snapshot ADD COLUMN IF NOT EXISTS leads_by_month JSONB DEFAULT '{}'::jsonb`);
  await client.query(
    `
      INSERT INTO pf_listings_snapshot (
        listing_id, reference, group_name, category, offering_type, title, status,
        budget, budget_by_month, leads_count, leads_by_month, source_updated_at, payload, synced_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9::jsonb,$10,$11::jsonb,$12,$13::jsonb,NOW()
      )
      ON CONFLICT (listing_id) DO UPDATE SET
        reference = EXCLUDED.reference,
        group_name = EXCLUDED.group_name,
        category = EXCLUDED.category,
        offering_type = EXCLUDED.offering_type,
        title = EXCLUDED.title,
        status = EXCLUDED.status,
        budget = EXCLUDED.budget,
        budget_by_month = EXCLUDED.budget_by_month,
        leads_count = EXCLUDED.leads_count,
        leads_by_month = EXCLUDED.leads_by_month,
        source_updated_at = EXCLUDED.source_updated_at,
        payload = EXCLUDED.payload,
        synced_at = NOW()
    `,
    [
      String(row.id || row.reference || ''),
      row.reference || null,
      row.groupName,
      row.categoryName,
      row.offeringType,
      row.title,
      row.state || row.status || null,
      Number(row.budget || 0),
      JSON.stringify(row.budgetByMonth || {}),
      Number(row.leadsCount || 0),
      JSON.stringify(row.leadsByMonth || {}),
      row.createdAt ? new Date(row.createdAt) : null,
      JSON.stringify(row.payload || {}),
    ],
  );
}

async function upsertProject(client, project) {
  await client.query(
    `
      INSERT INTO pf_projects_snapshot (
        project_id, reference, title, district, leads_count,
        leads_by_month, budget, budget_by_month, payload, synced_at
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6::jsonb,$7,$8::jsonb,$9::jsonb,NOW()
      )
      ON CONFLICT (project_id) DO UPDATE SET
        reference = EXCLUDED.reference,
        title = EXCLUDED.title,
        district = EXCLUDED.district,
        leads_count = EXCLUDED.leads_count,
        leads_by_month = EXCLUDED.leads_by_month,
        budget = EXCLUDED.budget,
        budget_by_month = EXCLUDED.budget_by_month,
        payload = EXCLUDED.payload,
        synced_at = NOW()
    `,
    [
      String(project.projectId),
      project.reference || null,
      project.title || null,
      project.district || 'Other',
      Number(project.leadsCount || 0),
      JSON.stringify(project.leadsByMonth || {}),
      Number(project.budget || 0),
      JSON.stringify(project.budgetByMonth || {}),
      JSON.stringify(project.payload || {}),
    ],
  );
}

function buildProjectLeadsSummary(rawLeads) {
  const grouped = new Map();
  for (const lead of rawLeads) {
    const id = lead?.project?.id;
    if (!id) continue;

    if (!grouped.has(id)) {
      grouped.set(id, {
        projectId: id,
        reference: lead.project?.reference || String(id),
        title: lead.project?.name || `Project ${id}`,
        district: 'Other',
        leadsCount: 0,
        leadsByMonth: {},
        budget: 0,
        budgetByMonth: {},
        payload: { sampleLead: lead },
      });
    }

    const row = grouped.get(id);
    row.leadsCount += 1;

    const month = String(lead.createdAt || '').slice(0, 7);
    if (month) row.leadsByMonth[month] = (row.leadsByMonth[month] || 0) + 1;
  }

  return Array.from(grouped.values());
}

async function main() {
  const connectionString = getConnectionString();
  const sslMode = (process.env.POSTGRES_SSL_MODE || 'require').toLowerCase();

  const client = new Client({
    connectionString,
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: false },
  });

  await client.connect();

  const runStart = await client.query(
    `INSERT INTO sync_runs (job_name, status, started_at, meta) VALUES ($1,$2,NOW(),$3::jsonb) RETURNING id`,
    ['sync_pf_to_postgres', 'running', JSON.stringify({ mode: 'api' })],
  );

  const runId = runStart.rows[0].id;

  try {
    const token = await getToken();
    const [credits, leads] = await Promise.all([
      fetchCreditsTransactions(token),
      fetchAllLeads(token),
    ]);

    const { byReferenceTotal, byReferenceMonth } = aggregateCredits(credits);
    const projectCreditsById = aggregateProjectCredits(credits);
    const ppBudget = aggregatePrimaryPlusBudget(credits);
    console.log(`[PROJECTS] PP Ad Campaign budget: ${ppBudget.total} credits across months: ${JSON.stringify(ppBudget.byMonth)}`);
    const { byRef: ourLeadsByRef, noRefTotal, noRefByMonth, noRefRows } = await loadOurListingLeadsFromSyncState(client);
    const knownListingRefs = new Set();

    const purgeRes = await client.query(`DELETE FROM pf_listings_snapshot`);
    const purgedExcludedRows = Number(purgeRes.rowCount || 0);

    let totalListings = 0;
    for (const cat of CATEGORIES) {
      const states = ['live', 'archived', 'unpublished', 'takendown'];
      for (const state of states) {
        const listings = await fetchAllListings(cat.category, cat.offeringType, state, token);
        for (const listing of listings) {
          const listingRef = normalizeListingRef(listing?.reference);
          // Determine groupName: use permit matching if available, otherwise default Our
          const groupName = getGroupNameForListing(listing) || cat.groupName;

          const isPartnerGroup = groupName === 'Partner' || groupName === 'AbuDhabi';

          // Our group: only save if we have leads for this listing
          if (!isPartnerGroup && (!listingRef || !ourLeadsByRef.has(listingRef))) {
            continue;
          }

          // Partner/AbuDhabi: only save if there are credit transactions (has budget)
          if (isPartnerGroup && !(byReferenceTotal[listing.reference] > 0)) {
            continue;
          }

          if (!isPartnerGroup) knownListingRefs.add(listingRef);
          const leadAgg = ourLeadsByRef.get(listingRef) || { total: 0, byMonth: {} };

          await upsertListing(client, {
            id: listing.id,
            reference: listing.reference,
            groupName,
            categoryName: cat.name,
            offeringType: cat.offeringType,
            title: listing.title?.en || listing.reference || `Listing ${listing.id}`,
            state,
            budget: byReferenceTotal[listing.reference] || 0,
            budgetByMonth: byReferenceMonth[listing.reference] || {},
            leadsCount: leadAgg.total,
            leadsByMonth: leadAgg.byMonth,
            createdAt: listing.createdAt,
            payload: listing,
          });
          totalListings += 1;
        }
      }
    }

    let unmatchedListingRefs = 0;
    let unattributedLeadsTotal = noRefTotal;
    const unattributedLeadsByMonth = { ...noRefByMonth };
    for (const [ref, agg] of ourLeadsByRef.entries()) {
      if (knownListingRefs.has(ref)) continue;
      unmatchedListingRefs += 1;
      unattributedLeadsTotal += Number(agg.total || 0);
      for (const [month, count] of Object.entries(agg.byMonth || {})) {
        unattributedLeadsByMonth[month] = (unattributedLeadsByMonth[month] || 0) + Number(count || 0);
      }
    }

    if (unattributedLeadsTotal > 0) {
      await upsertListing(client, {
        id: 'pf-unattributed-listing-leads',
        reference: null,
        groupName: 'Our',
        categoryName: 'Other',
        offeringType: 'other',
        title: 'Unattributed',
        state: 'unknown',
        budget: 0,
        budgetByMonth: {},
        leadsCount: unattributedLeadsTotal,
        leadsByMonth: unattributedLeadsByMonth,
        createdAt: null,
        payload: {
          source: 'leads-unmatched',
          note: 'Leads linked to listing references that are not present in current listings API snapshot',
        },
      });
      totalListings += 1;
    }

    const projects = buildProjectLeadsSummary(leads);
    const projectIds = new Set(projects.map((project) => String(project.projectId)));
    const projectDetails = await fetchProjectDetails(projectIds, token);

    // Distribute PP budget proportionally by leads (fallback to per-project credits if available)
    const distributedBudget = distributeBudgetByLeads(ppBudget, projects);

    await client.query(`DELETE FROM pf_projects_snapshot`);

    for (const project of projects) {
      const projectId = String(project.projectId);
      const detail = projectDetails.get(projectId) || {};
      // Use per-project credits if available (future-proof), else use proportional distribution
      const directAgg = projectCreditsById.get(projectId);
      const budgetAgg = directAgg?.totalCredits > 0
        ? directAgg
        : (distributedBudget.get(projectId) || { totalCredits: 0, byMonth: {} });

      await upsertProject(client, {
        projectId,
        reference: detail?.reference || project.reference || projectId,
        title:
          detail?.title?.en ||
          detail?.title?.ar ||
          detail?.name?.en ||
          detail?.name?.ar ||
          project.title ||
          detail?.reference ||
          `Project ${projectId}`,
        district:
          detail?.location?.name?.en ||
          detail?.location?.name?.ar ||
          project.district ||
          'Other',
        leadsCount: project.leadsCount,
        leadsByMonth: project.leadsByMonth,
        budget: budgetAgg.totalCredits,
        budgetByMonth: budgetAgg.byMonth,
        payload: {
          projectDetail: detail || null,
          sampleLead: project.payload?.sampleLead || null,
        },
      });
    }

    await client.query(
      `UPDATE sync_runs SET status='success', ended_at=NOW(), rows_processed=$1, meta = COALESCE(meta,'{}'::jsonb) || $2::jsonb WHERE id=$3`,
      [
        totalListings + projects.length,
        JSON.stringify({
          listings: totalListings,
          projects: projects.length,
          purged_excluded_rows: purgedExcludedRows,
          excluded_groups: Array.from(EXCLUDED_GROUPS),
          unmatched_listing_refs: unmatchedListingRefs,
          unattributed_listing_leads: unattributedLeadsTotal,
          listing_without_key_leads: noRefRows,
          credits_transactions_filter: { type: PF_CREDITS_TX_TYPE },
          project_budget_source: 'direct_project_credit_transactions_only',
          leads_total: leads.length,
        }),
        runId,
      ],
    );

    console.log(`SUCCESS: sync_pf_to_postgres. listings=${totalListings}, projects=${projects.length}`);
  } catch (error) {
    await client.query(
      `UPDATE sync_runs SET status='failed', ended_at=NOW(), error_message=$1 WHERE id=$2`,
      [error instanceof Error ? error.message : String(error), runId],
    );
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('FAILED: sync_pf_to_postgres', error.message || error);
  process.exit(1);
});
