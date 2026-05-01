/**
 * Upserts all PF AMO leads from CSV cache → pf_amo_sync_state table.
 *
 * Source: data/cache/pf_amo_leads_csv.json
 * Run:    node scripts/kpi/upsert_pf_amo_leads_to_db.mjs
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CACHE_FILE = path.resolve(ROOT, 'data/cache/pf_amo_leads_csv.json');

function getConnectionString() {
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  const { POSTGRES_HOST: h, POSTGRES_PORT: p = '5432', POSTGRES_DB: db, POSTGRES_USER: u, POSTGRES_PASSWORD: pw } = process.env;
  if (!h || !db || !u || !pw) throw new Error('Missing PostgreSQL env vars');
  return `postgresql://${encodeURIComponent(u)}:${encodeURIComponent(pw)}@${h}:${p}/${db}?sslmode=require`;
}

async function main() {
  if (!fs.existsSync(CACHE_FILE)) {
    console.error(`Cache not found: ${CACHE_FILE}`);
    console.error('Run: node scripts/kpi/import_pf_amo_csv.mjs first');
    process.exit(1);
  }

  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  const leads = cache.leads || [];
  console.log(`Loaded ${leads.length} leads from cache`);

  const groupedByPfLeadId = new Map();
  for (const lead of leads) {
    const pfLeadId = String(lead.pf_lead_id || '').trim();
    if (!pfLeadId) continue;

    if (!groupedByPfLeadId.has(pfLeadId)) {
      groupedByPfLeadId.set(pfLeadId, {
        base: lead,
        count: 0,
        amoLeadIds: [],
      });
    }

    const agg = groupedByPfLeadId.get(pfLeadId);
    agg.count += 1;
    agg.amoLeadIds.push(String(lead.id));

    // Keep most recent lead by created_at as the row base.
    if (Number(lead.created_at || 0) >= Number(agg.base?.created_at || 0)) {
      agg.base = lead;
    }
  }

  const collapsedLeads = Array.from(groupedByPfLeadId.values()).map((x) => ({
    ...x.base,
    duplicate_count: x.count,
    amo_lead_ids: x.amoLeadIds,
  }));
  console.log(`Collapsed to ${collapsedLeads.length} unique PF Lead IDs`);

  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let upserted = 0;
  let errors = 0;
  const now = new Date().toISOString();

  for (const lead of collapsedLeads) {
    const payload = {
      amo_lead_id: lead.id,
      created_at: lead.created_at,
      created_month: lead.created_month,
      phones: lead.phones,
      stage: lead.stage,
      pf_listing_ref: lead.pf_listing_ref,
      pf_category: lead.pf_category,
      pf_channel_type: lead.pf_channel_type,
      pf_status: lead.pf_status,
      pf_listing_url: lead.pf_listing_url,
      isSpam: lead.isSpam,
      isQualified: lead.isQualified,
      isQlActual: lead.isQlActual,
      isMeeting: lead.isMeeting,
      isDeal: lead.isDeal,
      duplicate_count: Number(lead.duplicate_count || 1),
      amo_lead_ids: Array.isArray(lead.amo_lead_ids) ? lead.amo_lead_ids : [String(lead.id)],
    };

    try {
      await client.query(
        `INSERT INTO pf_amo_sync_state (pf_lead_id, amo_lead_id, synced_at, payload)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (pf_lead_id) DO UPDATE SET
           amo_lead_id = EXCLUDED.amo_lead_id,
           synced_at   = EXCLUDED.synced_at,
           payload     = EXCLUDED.payload`,
        [lead.pf_lead_id, BigInt(lead.id), now, JSON.stringify(payload)],
      );
      upserted++;
    } catch (e) {
      console.error(`  Error on lead ${lead.id} (${lead.pf_lead_id}): ${e.message}`);
      errors++;
    }
  }

  await client.end();

  console.log(`\n✓ Upserted: ${upserted} rows`);
  if (errors > 0) console.warn(`  Errors: ${errors}`);

  // Verify
  const verify = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await verify.connect();
  const r = await verify.query('SELECT COUNT(*) FROM pf_amo_sync_state');
  console.log(`  DB total rows in pf_amo_sync_state: ${r.rows[0].count}`);
  await verify.end();
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
