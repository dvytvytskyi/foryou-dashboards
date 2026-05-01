import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const AMO_PROVIDER = 'amo';
const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');

const PF_FIELD_LEAD_ID = Number(process.env.AMO_PF_FIELD_LEAD_ID || 1516909);
const PF_FIELD_LISTING_REF = Number(process.env.AMO_PF_FIELD_LISTING_REF || 1526392);
const PF_FIELD_LISTING_ID = Number(process.env.AMO_PF_FIELD_LISTING_ID || 1526388);
const PF_FIELD_LISTING_URL = Number(process.env.AMO_PF_FIELD_LISTING_URL || 1526390);
const PF_FIELD_CHANNEL_TYPE = Number(process.env.AMO_PF_FIELD_CHANNEL_TYPE || 1450527);

const MAX_BACKFILL_ROWS = Number(process.env.PF_AMO_BACKFILL_LIMIT || 1000);

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

function parseJsonSafe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readTokensFromFileOrEnv() {
  if (process.env.AMO_TOKENS_JSON) {
    const parsed = parseJsonSafe(process.env.AMO_TOKENS_JSON);
    if (parsed && typeof parsed === 'object') return parsed;
  }

  if (fs.existsSync(AMO_TOKENS_FILE)) {
    const parsed = parseJsonSafe(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object') return parsed;
  }

  throw new Error('No AMO tokens found in AMO_TOKENS_JSON or secrets/amo_tokens.json');
}

function persistTokensToFile(tokens) {
  try {
    fs.mkdirSync(path.dirname(AMO_TOKENS_FILE), { recursive: true });
    fs.writeFileSync(AMO_TOKENS_FILE, JSON.stringify(tokens, null, 2));
  } catch {
    // ignore write issues in CI
  }
}

async function ensureTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS integration_tokens (
      provider TEXT PRIMARY KEY,
      tokens JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS pf_amo_sync_state (
      pf_lead_id TEXT PRIMARY KEY,
      amo_lead_id BIGINT NOT NULL,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      payload JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);
}

async function readAmoTokens(client) {
  const row = await client.query(
    `SELECT tokens FROM integration_tokens WHERE provider = $1 LIMIT 1`,
    [AMO_PROVIDER],
  );

  const dbTokens = row.rows[0]?.tokens;
  if (dbTokens && typeof dbTokens === 'object' && dbTokens.access_token) {
    return dbTokens;
  }

  const fallback = readTokensFromFileOrEnv();
  await client.query(
    `
      INSERT INTO integration_tokens(provider, tokens, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (provider)
      DO UPDATE SET tokens = EXCLUDED.tokens, updated_at = NOW()
    `,
    [AMO_PROVIDER, JSON.stringify(fallback)],
  );
  return fallback;
}

async function writeAmoTokens(client, tokens) {
  await client.query(
    `
      INSERT INTO integration_tokens(provider, tokens, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (provider)
      DO UPDATE SET tokens = EXCLUDED.tokens, updated_at = NOW()
    `,
    [AMO_PROVIDER, JSON.stringify(tokens)],
  );
  persistTokensToFile(tokens);
}

async function refreshAmoTokens(tokens) {
  const domain = (process.env.AMO_DOMAIN || 'reforyou.amocrm.ru').replace(/^https?:\/\//i, '').replace(/\/+$/g, '');
  const clientId = process.env.AMO_CLIENT_ID;
  const clientSecret = process.env.AMO_CLIENT_SECRET;
  const redirectUri = process.env.AMO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri || !tokens?.refresh_token) {
    throw new Error('Missing AMO refresh credentials or refresh_token');
  }

  const res = await fetch(`https://${domain}/oauth2/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      redirect_uri: redirectUri,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data?.access_token) {
    throw new Error(`AMO refresh failed: ${JSON.stringify(data)}`);
  }

  return {
    ...tokens,
    ...data,
    server_time: Math.floor(Date.now() / 1000),
  };
}

async function amoFetch(client, pathname, init = {}) {
  const domain = (process.env.AMO_DOMAIN || 'reforyou.amocrm.ru').replace(/^https?:\/\//i, '').replace(/\/+$/g, '');
  const pathOnly = pathname.startsWith('/') ? pathname : `/${pathname}`;

  let tokens = await readAmoTokens(client);

  const call = (accessToken) =>
    fetch(`https://${domain}${pathOnly}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${accessToken || ''}`,
      },
    });

  let res = await call(tokens.access_token);
  if (res.status !== 401) return res;

  tokens = await refreshAmoTokens(tokens);
  await writeAmoTokens(client, tokens);

  res = await call(tokens.access_token);
  return res;
}

function normalizeFromPayload(value) {
  const out = String(value || '').trim();
  return out && out !== '-' ? out : '';
}

function extractFieldFromComment(comment, label) {
  const text = String(comment || '');
  const pattern = new RegExp(`^${label}\\s*:\\s*(.+)$`, 'mi');
  const match = text.match(pattern);
  return normalizeFromPayload(match?.[1] || '');
}

function getLeadFieldValue(lead, fieldId) {
  const fields = lead?.custom_fields_values || [];
  const field = fields.find((item) => Number(item?.field_id) === Number(fieldId));
  return normalizeFromPayload(field?.values?.[0]?.value || '');
}

function getCommentText(lead) {
  const fields = lead?.custom_fields_values || [];
  const commentField = fields.find((item) => Number(item?.field_id) === 1343875);
  return normalizeFromPayload(commentField?.values?.[0]?.value || '');
}

function buildUpdateData(pfLeadId, amoLead, payload) {
  const comment = getCommentText(amoLead);

  const listingRef = normalizeFromPayload(
    payload?.pf_listing_ref ||
      payload?.listingRef ||
      getLeadFieldValue(amoLead, PF_FIELD_LISTING_REF) ||
      extractFieldFromComment(comment, 'Listing Ref'),
  );

  const listingId = normalizeFromPayload(
    payload?.pf_listing_id ||
      payload?.listingId ||
      getLeadFieldValue(amoLead, PF_FIELD_LISTING_ID) ||
      extractFieldFromComment(comment, 'Listing ID'),
  );

  const listingUrl = normalizeFromPayload(
    payload?.pf_listing_url ||
      payload?.listingUrl ||
      getLeadFieldValue(amoLead, PF_FIELD_LISTING_URL) ||
      extractFieldFromComment(comment, 'Listing URL'),
  );

  const channel = normalizeFromPayload(
    payload?.pf_channel_type ||
      payload?.channel ||
      getLeadFieldValue(amoLead, PF_FIELD_CHANNEL_TYPE) ||
      extractFieldFromComment(comment, 'Channel'),
  );

  let createdAt = null;
  const pfCreatedAt = String(payload?.createdAt || payload?.created_at_iso || '').trim();
  if (pfCreatedAt) {
    const ts = Date.parse(pfCreatedAt);
    if (Number.isFinite(ts)) createdAt = Math.floor(ts / 1000);
  } else {
    const tsNum = Number(payload?.created_at || 0);
    if (Number.isFinite(tsNum) && tsNum > 0) createdAt = tsNum;
  }

  const customFields = [
    { field_id: PF_FIELD_LEAD_ID, values: [{ value: String(pfLeadId) }] },
    { field_id: PF_FIELD_LISTING_REF, values: [{ value: listingRef }] },
    { field_id: PF_FIELD_LISTING_ID, values: [{ value: listingId }] },
    { field_id: PF_FIELD_LISTING_URL, values: [{ value: listingUrl }] },
    { field_id: PF_FIELD_CHANNEL_TYPE, values: [{ value: channel }] },
  ];

  return { customFields, createdAt };
}

async function patchLeadWithRetry(client, amoLeadId, updateData) {
  const base = {
    id: Number(amoLeadId),
    custom_fields_values: updateData.customFields,
  };

  const withCreatedAt = updateData.createdAt
    ? { ...base, created_at: updateData.createdAt }
    : base;

  let res = await amoFetch(client, `/api/v4/leads/${Number(amoLeadId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withCreatedAt),
  });

  if (res.ok) return { ok: true, createdAtUpdated: Boolean(updateData.createdAt) };

  const errText = await res.text();
  if (!updateData.createdAt) {
    return { ok: false, error: `PATCH failed (${res.status}): ${errText.slice(0, 300)}` };
  }

  // Some accounts may block changing system created_at for existing leads.
  res = await amoFetch(client, `/api/v4/leads/${Number(amoLeadId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(base),
  });

  if (res.ok) {
    return {
      ok: true,
      createdAtUpdated: false,
      createdAtSkippedReason: `created_at patch rejected: ${errText.slice(0, 200)}`,
    };
  }

  const errText2 = await res.text();
  return { ok: false, error: `PATCH failed (${res.status}): ${errText2.slice(0, 300)}` };
}

async function fetchAmoLead(client, amoLeadId) {
  const res = await amoFetch(client, `/api/v4/leads/${Number(amoLeadId)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET lead failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function main() {
  const connectionString = getConnectionString();
  const sslMode = (process.env.POSTGRES_SSL_MODE || 'require').toLowerCase();

  const client = new Client({
    connectionString,
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  await ensureTables(client);

  try {
    const { rows } = await client.query(
      `
        SELECT pf_lead_id, amo_lead_id, payload
        FROM pf_amo_sync_state
        WHERE amo_lead_id IS NOT NULL
        ORDER BY synced_at ASC
        LIMIT $1
      `,
      [MAX_BACKFILL_ROWS],
    );

    let success = 0;
    let failed = 0;
    let createdAtUpdated = 0;
    let createdAtSkipped = 0;

    for (const row of rows) {
      const pfLeadId = String(row.pf_lead_id || '').trim();
      const amoLeadId = Number(row.amo_lead_id || 0);
      const payload = row.payload || {};

      if (!pfLeadId || !Number.isFinite(amoLeadId) || amoLeadId <= 0) {
        failed += 1;
        continue;
      }

      let amoLead = null;
      try {
        amoLead = await fetchAmoLead(client, amoLeadId);
      } catch (err) {
        failed += 1;
        console.error(`[PF AMO BACKFILL] Lead ${amoLeadId} fetch failed: ${err.message || err}`);
        continue;
      }

      const updateData = buildUpdateData(pfLeadId, amoLead, payload);

      const patchRes = await patchLeadWithRetry(client, amoLeadId, updateData);
      if (!patchRes.ok) {
        failed += 1;
        console.error(`[PF AMO BACKFILL] Lead ${amoLeadId} failed: ${patchRes.error}`);
        continue;
      }

      success += 1;
      if (patchRes.createdAtUpdated) createdAtUpdated += 1;
      if (!patchRes.createdAtUpdated) createdAtSkipped += 1;
    }

    console.log(
      JSON.stringify(
        {
          success: true,
          scannedStateRows: rows.length,
          amoLeadsFetched: rows.length,
          updatedLeads: success,
          failed,
          createdAtUpdated,
          createdAtSkipped,
          fieldIds: {
            listingRef: PF_FIELD_LISTING_REF,
            listingId: PF_FIELD_LISTING_ID,
            listingUrl: PF_FIELD_LISTING_URL,
            channel: PF_FIELD_CHANNEL_TYPE,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[PF AMO BACKFILL] Fatal:', err.message || err);
  process.exit(1);
});
