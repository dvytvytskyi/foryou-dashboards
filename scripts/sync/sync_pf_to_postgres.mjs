import { Client } from 'pg';

const API_URL = 'https://atlas.propertyfinder.com/v1';

const CATEGORIES = [
  { name: 'Sell', category: 'residential', offeringType: 'sale', groupName: 'Our' },
  { name: 'Rent', category: 'residential', offeringType: 'rent', groupName: 'Our' },
  { name: 'Commercial Sell', category: 'commercial', offeringType: 'sale', groupName: 'Partner' },
  { name: 'Commercial Rent', category: 'commercial', offeringType: 'rent', groupName: 'Partner' },
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
    const res = await fetch(`${API_URL}/credits/transactions?perPage=50&page=${page}`, {
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
        sample: lead,
      });
    }
    detailsByKey.get(key).count += 1;

    if (listingId) {
      byListingId.set(listingId, (byListingId.get(listingId) || 0) + 1);
    }
    if (listingRef) {
      byListingRef.set(listingRef, (byListingRef.get(listingRef) || 0) + 1);
    }
  }

  return { byListingId, byListingRef, detailsByKey, listingWithoutKeyCount };
}

function aggregateCredits(txs) {
  const byReferenceTotal = {};
  const byReferenceMonth = {};

  for (const tx of txs) {
    const ref = tx.listingInfo?.reference;
    if (!ref) continue;
    const isChargeCredits = tx.transactionInfo?.action === 'charge' && tx.transactionInfo?.type === 'credits';
    if (!isChargeCredits) continue;

    const amount = Math.abs(Number(tx.transactionInfo?.amount || 0));
    byReferenceTotal[ref] = (byReferenceTotal[ref] || 0) + amount;

    const month = String(tx.createdAt || '').slice(0, 7);
    if (!byReferenceMonth[ref]) byReferenceMonth[ref] = {};
    byReferenceMonth[ref][month] = (byReferenceMonth[ref][month] || 0) + amount;
  }

  return { byReferenceTotal, byReferenceMonth };
}

async function upsertListing(client, row) {
  await client.query(
    `
      INSERT INTO pf_listings_snapshot (
        listing_id, reference, group_name, category, offering_type, title, status,
        budget, budget_by_month, leads_count, source_updated_at, payload, synced_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9::jsonb,$10,$11,$12::jsonb,NOW()
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

          const leadsCount =
            (listingId && byListingId.get(listingId)) ||
            (listingRef && byListingRef.get(listingRef)) ||
            0;

          await upsertListing(client, {
            id: listing.id,
            reference: listing.reference,
            groupName: cat.groupName,
            categoryName: cat.name,
            offeringType: cat.offeringType,
            title: listing.title?.en || listing.reference || `Listing ${listing.id}`,
            state,
            budget: byReferenceTotal[listing.reference] || 0,
            budgetByMonth: byReferenceMonth[listing.reference] || {},
            leadsCount,
            createdAt: listing.createdAt,
            payload: listing,
          });
          totalListings += 1;
        }
      }
    }

    let unmatchedListings = 0;
    for (const detail of detailsByKey.values()) {
      const key = detail.listingId || `ref:${detail.listingRef}`;
      if (!key || knownListingKeys.has(key)) continue;

      const syntheticId = detail.listingId || `unmatched-ref-${detail.listingRef}`;
      const syntheticRef = detail.listingRef || null;

      await upsertListing(client, {
        id: syntheticId,
        reference: syntheticRef,
        groupName: 'Our',
        categoryName: 'Other',
        offeringType: 'other',
        title: syntheticRef ? `Unmatched listing ${syntheticRef}` : `Unmatched listing ${syntheticId}`,
        state: 'unknown',
        budget: 0,
        budgetByMonth: {},
        leadsCount: detail.count,
        createdAt: detail.sample?.createdAt || null,
        payload: {
          source: 'leads-unmatched',
          sampleLead: detail.sample || null,
        },
      });

      unmatchedListings += 1;
      totalListings += 1;
    }

    if (listingWithoutKeyCount > 0) {
      await upsertListing(client, {
        id: 'unmatched-listing-no-id-ref',
        reference: null,
        groupName: 'Our',
        categoryName: 'Other',
        offeringType: 'other',
        title: 'Unmatched listing leads (missing listing.id/reference)',
        state: 'unknown',
        budget: 0,
        budgetByMonth: {},
        leadsCount: listingWithoutKeyCount,
        createdAt: null,
        payload: {
          source: 'leads-unmatched-no-key',
        },
      });
      totalListings += 1;
    }

    const projects = buildProjectLeadsSummary(leads);
    for (const project of projects) {
      await upsertProject(client, project);
    }

    await client.query(
      `UPDATE sync_runs SET status='success', ended_at=NOW(), rows_processed=$1, meta = COALESCE(meta,'{}'::jsonb) || $2::jsonb WHERE id=$3`,
      [
        totalListings + projects.length,
        JSON.stringify({
          listings: totalListings,
          projects: projects.length,
          unmatched_listings: unmatchedListings,
          listing_without_key_leads: listingWithoutKeyCount,
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
