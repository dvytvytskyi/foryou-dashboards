import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = 'https://atlas.propertyfinder.com/v1';
const PF_CREDITS_TX_TYPE = 'credits';

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

// Build a project name -> groupName lookup for better matching
function getGroupNameForListing(listing) {
  // Try matching by listing reference first
  if (listing.reference) {
    const ref = String(listing.reference).trim();
    for (const permit of brokerPermitsList) {
      if (permit.permit === ref) return permit.groupName;
    }
  }

  // Try matching by project name (title contains project name)
  if (listing.title?.en) {
    const title = listing.title.en.toLowerCase();
    for (const permit of brokerPermitsList) {
      if (permit.project) {
        const projectName = permit.project.toLowerCase();
        if (title.includes(projectName)) return permit.groupName;
      }
    }
  }

  // Try matching by reference after removing leading zeros
  if (listing.reference) {
    const ref = String(listing.reference);
    const refNum = ref.replace(/^0+/, ''); // Remove leading zeros
    if (refNum && refNum !== ref) {
      for (const permit of brokerPermitsList) {
        if (permit.permit === refNum) return permit.groupName;
      }
    }
  }

  // Default fallback
  return 'Our';
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
    const { byListingId, byListingRef, detailsByKey, listingWithoutKeyCount } = buildListingLeadMaps(leads);
    const knownListingKeys = new Set();

    let totalListings = 0;
    for (const cat of CATEGORIES) {
      const states = ['live', 'archived', 'unpublished', 'takendown'];
      for (const state of states) {
        const listings = await fetchAllListings(cat.category, cat.offeringType, state, token);
        for (const listing of listings) {
          const listingId = listing?.id ? String(listing.id) : null;
          const listingRef = listing?.reference ? String(listing.reference) : null;
          if (listingId) knownListingKeys.add(listingId);
          if (listingRef) knownListingKeys.add(`ref:${listingRef}`);

          const leadAgg =
            (listingId && byListingId.get(listingId)) ||
            (listingRef && byListingRef.get(listingRef)) ||
            { total: 0, byMonth: {} };

          // Determine groupName: use permit/project matching if available, otherwise use category default
          const groupName = getGroupNameForListing(listing) || cat.groupName;

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
    let unattributedLeadsTotal = 0;
    const unattributedLeadsByMonth = {};
    for (const detail of detailsByKey.values()) {
      const key = detail.listingId || `ref:${detail.listingRef}`;
      if (!key || knownListingKeys.has(key)) continue;
      unmatchedListingRefs += 1;
      unattributedLeadsTotal += Number(detail.count || 0);
      for (const [month, count] of Object.entries(detail.byMonth || {})) {
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

    await client.query(`DELETE FROM pf_projects_snapshot`);

    for (const project of projects) {
      const projectId = String(project.projectId);
      const detail = projectDetails.get(projectId) || {};
      const budgetAgg = projectCreditsById.get(projectId) || { totalCredits: 0, byMonth: {} };

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
          unmatched_listing_refs: unmatchedListingRefs,
          unattributed_listing_leads: unattributedLeadsTotal,
          listing_without_key_leads: listingWithoutKeyCount,
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
