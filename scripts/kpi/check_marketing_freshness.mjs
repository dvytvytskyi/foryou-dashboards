import path from 'path';
import { fileURLToPath } from 'url';
import { BigQuery } from '@google-cloud/bigquery';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';

const MARKETING_CHANNELS = ['Facebook', 'Klykov', 'RED'];
const MAX_LAG_HOURS_MARKETING = Number(process.env.MAX_LAG_HOURS_MARKETING || 3);
const MAX_LAG_HOURS_RED_RAW = Number(process.env.MAX_LAG_HOURS_RED_RAW || 3);

const bqCredentials = process.env.GOOGLE_AUTH_JSON
  ? JSON.parse(process.env.GOOGLE_AUTH_JSON)
  : undefined;

const bq = new BigQuery({
  projectId: PROJECT_ID,
  credentials: bqCredentials,
  keyFilename: !bqCredentials
    ? path.resolve(rootDir, 'secrets/crypto-world-epta-2db29829d55d.json')
    : undefined,
});

function toIso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value.value) return value.value;
  return String(value);
}

function lagHours(timestampIso) {
  if (!timestampIso) return Number.POSITIVE_INFINITY;
  const t = new Date(timestampIso).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / (1000 * 60 * 60);
}

async function main() {
  const channelQuery = `
    SELECT
      channel,
      MAX(refreshed_at) AS max_refreshed_at,
      MAX(report_date) AS max_report_date,
      COUNT(*) AS rows_count
    FROM \`${PROJECT_ID}.${DATASET_ID}.marketing_channel_drilldown_daily\`
    WHERE channel IN UNNEST(@channels)
    GROUP BY channel
  `;

  const redRawQuery = `
    SELECT
      MAX(synced_at) AS max_synced_at,
      MAX(updated_at) AS max_updated_at,
      MAX(created_at) AS max_created_at,
      COUNT(*) AS rows_count
    FROM \`${PROJECT_ID}.${DATASET_ID}.red_leads_raw\`
    WHERE tag IN ('RED_RU', 'RED_ENG', 'RED_ARM', 'RED_LUX')
  `;

  const [channelRows] = await bq.query({
    query: channelQuery,
    params: { channels: MARKETING_CHANNELS },
  });

  const [redRawRows] = await bq.query({ query: redRawQuery });
  const redRaw = redRawRows[0] || {};

  const byChannel = new Map(channelRows.map((r) => [String(r.channel), r]));
  const failures = [];

  for (const channel of MARKETING_CHANNELS) {
    const row = byChannel.get(channel);
    if (!row) {
      failures.push(`Channel ${channel}: no rows in marketing_channel_drilldown_daily`);
      continue;
    }

    const refreshedAt = toIso(row.max_refreshed_at);
    const reportDate = toIso(row.max_report_date);
    const lag = lagHours(refreshedAt);

    console.log(
      `[freshness] ${channel}: refreshed_at=${refreshedAt || 'null'} report_date=${reportDate || 'null'} lag_hours=${lag.toFixed(2)} rows=${row.rows_count}`,
    );

    if (!Number.isFinite(lag) || lag > MAX_LAG_HOURS_MARKETING) {
      failures.push(
        `Channel ${channel}: refreshed_at lag ${Number.isFinite(lag) ? lag.toFixed(2) : 'inf'}h exceeds ${MAX_LAG_HOURS_MARKETING}h`,
      );
    }
  }

  const redSyncedAt = toIso(redRaw.max_synced_at);
  const redLag = lagHours(redSyncedAt);
  console.log(
    `[freshness] RED raw: synced_at=${redSyncedAt || 'null'} updated_at=${toIso(redRaw.max_updated_at) || 'null'} created_at=${toIso(redRaw.max_created_at) || 'null'} lag_hours=${redLag.toFixed(2)} rows=${redRaw.rows_count ?? 0}`,
  );

  if (!Number.isFinite(redLag) || redLag > MAX_LAG_HOURS_RED_RAW) {
    failures.push(
      `RED raw: synced_at lag ${Number.isFinite(redLag) ? redLag.toFixed(2) : 'inf'}h exceeds ${MAX_LAG_HOURS_RED_RAW}h`,
    );
  }

  if (failures.length > 0) {
    console.error('\nFreshness check failed:');
    for (const msg of failures) {
      console.error(`- ${msg}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nFreshness check passed.');
}

main().catch((err) => {
  console.error('Freshness check error:', err);
  process.exitCode = 1;
});
