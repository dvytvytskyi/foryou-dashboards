import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const AMO_PROVIDER = 'amo';
const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const PF_PROJECT_URL_MAP_FILE = path.resolve('./pf_project_url_map.json');

const PF_FIELD_LEAD_ID = Number(process.env.AMO_PF_FIELD_LEAD_ID || 1516909);
const PF_FIELD_LISTING_REF = Number(process.env.AMO_PF_FIELD_LISTING_REF || 1526392);
const PF_FIELD_LISTING_ID = Number(process.env.AMO_PF_FIELD_LISTING_ID || 1526388);
const PF_FIELD_LISTING_URL = Number(process.env.AMO_PF_FIELD_LISTING_URL || 1526390);
const PF_FIELD_RESPONSE_LINK = Number(process.env.AMO_PF_FIELD_RESPONSE_LINK || 0);
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

function loadProjectUrlOverrides() {
  if (process.env.PF_PROJECT_URL_MAP_JSON) {
    const parsed = parseJsonSafe(process.env.PF_PROJECT_URL_MAP_JSON);
    if (parsed && typeof parsed === 'object') return parsed;
  }

  if (fs.existsSync(PF_PROJECT_URL_MAP_FILE)) {
    const parsed = parseJsonSafe(fs.readFileSync(PF_PROJECT_URL_MAP_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object') return parsed;
  }

  return {};
}

const PROJECT_URL_OVERRIDES = loadProjectUrlOverrides();

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

function slugifyPfPathPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildPfProjectDirectUrl(projectId, projectTitle, developerName) {
  const id = normalizeFromPayload(projectId);
  if (id) {
    const override = normalizeFromPayload(PROJECT_URL_OVERRIDES[id]);
    if (override) return override;
  }

  const developerSlug = slugifyPfPathPart(developerName);
  const projectSlug = slugifyPfPathPart(projectTitle);
  if (developerSlug && projectSlug) {
    return `https://www.propertyfinder.ae/en/new-projects/${developerSlug}/${projectSlug}`;
  }

  return '';
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    const out = normalizeFromPayload(value);
    if (out) return out;
  }
  return '';
}

function isLegacyProjectUrl(url) {
  return /^https?:\/\/www\.propertyfinder\.ae\/en\/new-developments\/project\/[a-f0-9-]+(?:[/?#].*)?$/i
    .test(String(url || '').trim());
}

function buildListingUrlFromStoredPayload(payload, listingRef, listingId, projectMeta = null) {
  const entityType = String(payload?.entityType || payload?.pf_category || '').trim().toLowerCase();

  if (entityType === 'project') {
    const projectId = firstNonEmptyString(payload?.projectId, payload?.project_id, listingRef, listingId);
    const projectTitle = firstNonEmptyString(
      payload?.projectTitle,
      payload?.project_title,
      payload?.title,
      payload?.projectName,
      payload?.project_name,
      projectMeta?.title,
    );
    const projectDeveloper = firstNonEmptyString(
      payload?.projectDeveloper,
      payload?.project_developer,
      payload?.developer,
      payload?.developerName,
      projectMeta?.developerName,
    );

    const directProjectUrl = buildPfProjectDirectUrl(projectId, projectTitle, projectDeveloper);
    if (directProjectUrl) return directProjectUrl;

    const payloadProjectUrl = firstNonEmptyString(
      payload?.pf_listing_url,
      payload?.listingUrl,
      payload?.projectUrl,
      payload?.project_url,
      payload?.url,
    );
    if (payloadProjectUrl && !isLegacyProjectUrl(payloadProjectUrl)) return payloadProjectUrl;

    const query = projectTitle || projectId;
    if (query) return `https://www.propertyfinder.ae/en/new-projects?search=${encodeURIComponent(query)}`;
    return '';
  }

  const payloadListingUrl = firstNonEmptyString(
    payload?.pf_listing_url,
    payload?.listingUrl,
    payload?.listing_url,
    payload?.url,
  );
  if (payloadListingUrl) return payloadListingUrl;

  if (listingRef) return `https://www.propertyfinder.ae/en/search?q=${encodeURIComponent(listingRef)}`;
  if (listingId) return `https://www.propertyfinder.ae/en/search?q=${encodeURIComponent(listingId)}`;
  return '';
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

function buildUpdateData(pfLeadId, amoLead, payload, projectMeta = null) {
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

  const rebuiltListingUrl = buildListingUrlFromStoredPayload(payload, listingRef, listingId, projectMeta);
  const listingUrl = normalizeFromPayload(
    rebuiltListingUrl ||
      getLeadFieldValue(amoLead, PF_FIELD_LISTING_URL) ||
      extractFieldFromComment(comment, 'Listing URL') ||
      extractFieldFromComment(comment, 'URL'),
  );

  const responseLink = normalizeFromPayload(
    payload?.responseLink ||
      payload?.pf_response_link ||
      (PF_FIELD_RESPONSE_LINK > 0 ? getLeadFieldValue(amoLead, PF_FIELD_RESPONSE_LINK) : '') ||
      extractFieldFromComment(comment, 'Response Link'),
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
  if (PF_FIELD_RESPONSE_LINK > 0 && responseLink) {
    customFields.push({ field_id: PF_FIELD_RESPONSE_LINK, values: [{ value: responseLink }] });
  }

  return { customFields, createdAt };
}

async function lookupProjectMeta(client, projectId) {
  if (!projectId) return null;
  const res = await client.query(
    `
      SELECT
        title,
        COALESCE(
          payload->'projectDetail'->'developer'->'name'->>'en',
          payload->'projectDetail'->'developer'->>'name',
          ''
        ) AS developer_name
      FROM pf_projects_snapshot
      WHERE project_id = $1
      LIMIT 1
    `,
    [String(projectId)],
  );
  if (!res.rows.length) return null;
  return {
    title: normalizeFromPayload(res.rows[0]?.title),
    developerName: normalizeFromPayload(res.rows[0]?.developer_name),
  };
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
    const projectMetaCache = new Map();

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

      const entityType = String(payload?.entityType || payload?.pf_category || '').trim().toLowerCase();
      const projectId = normalizeFromPayload(payload?.projectId || payload?.project_id || payload?.pf_listing_ref || payload?.listingRef);
      let projectMeta = null;
      if (entityType === 'project' && projectId) {
        if (!projectMetaCache.has(projectId)) {
          try {
            projectMetaCache.set(projectId, await lookupProjectMeta(client, projectId));
          } catch {
            projectMetaCache.set(projectId, null);
          }
        }
        projectMeta = projectMetaCache.get(projectId);
      }

      const updateData = buildUpdateData(pfLeadId, amoLead, payload, projectMeta);

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
            responseLink: PF_FIELD_RESPONSE_LINK,
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
