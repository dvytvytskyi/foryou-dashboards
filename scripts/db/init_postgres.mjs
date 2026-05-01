import 'dotenv/config';
import { Client } from 'pg';

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

const DDL = `
CREATE TABLE IF NOT EXISTS sync_runs (
  id BIGSERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  rows_processed INTEGER,
  error_message TEXT,
  meta JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS pf_listings_snapshot (
  listing_id TEXT PRIMARY KEY,
  reference TEXT,
  group_name TEXT,
  category TEXT,
  offering_type TEXT,
  title TEXT,
  status TEXT,
  budget NUMERIC DEFAULT 0,
  budget_by_month JSONB DEFAULT '{}'::jsonb,
  leads_count INTEGER DEFAULT 0,
  leads_by_month JSONB DEFAULT '{}'::jsonb,
  source_updated_at TIMESTAMPTZ,
  payload JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pf_listings_reference ON pf_listings_snapshot(reference);
CREATE INDEX IF NOT EXISTS idx_pf_listings_group_name ON pf_listings_snapshot(group_name);

CREATE TABLE IF NOT EXISTS pf_projects_snapshot (
  project_id TEXT PRIMARY KEY,
  reference TEXT,
  title TEXT,
  district TEXT,
  leads_count INTEGER DEFAULT 0,
  leads_by_month JSONB DEFAULT '{}'::jsonb,
  budget NUMERIC DEFAULT 0,
  budget_by_month JSONB DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_deals_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  deal_date DATE,
  deal_type TEXT NOT NULL,
  broker TEXT,
  partner TEXT,
  source_label TEXT,
  gmv NUMERIC DEFAULT 0,
  gross NUMERIC DEFAULT 0,
  net NUMERIC DEFAULT 0,
  payload JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_deals_source_file ON sales_deals_raw(source_file);
CREATE INDEX IF NOT EXISTS idx_sales_deals_deal_date ON sales_deals_raw(deal_date);

CREATE TABLE IF NOT EXISTS pf_amo_project_match_stats (
  project_id TEXT PRIMARY KEY,
  crm_leads INT NOT NULL DEFAULT 0,
  spam INT NOT NULL DEFAULT 0,
  qualified_leads INT NOT NULL DEFAULT 0,
  ql_actual INT NOT NULL DEFAULT 0,
  meetings INT NOT NULL DEFAULT 0,
  deals INT NOT NULL DEFAULT 0,
  crm_leads_by_month JSONB NOT NULL DEFAULT '{}',
  spam_by_month JSONB NOT NULL DEFAULT '{}',
  qualified_leads_by_month JSONB NOT NULL DEFAULT '{}',
  ql_actual_by_month JSONB NOT NULL DEFAULT '{}',
  meetings_by_month JSONB NOT NULL DEFAULT '{}',
  deals_by_month JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function main() {
  const connectionString = getConnectionString();
  const sslMode = (process.env.POSTGRES_SSL_MODE || 'require').toLowerCase();

  const client = new Client({
    connectionString,
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(DDL);
    console.log('SUCCESS: PostgreSQL schema initialized');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('FAILED: init_postgres', error.message || error);
  process.exit(1);
});
