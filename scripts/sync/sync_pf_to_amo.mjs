import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const PF_API_URL = 'https://atlas.propertyfinder.com/v1';
const AMO_PROVIDER = 'amo';
const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const PF_PROJECT_URL_MAP_FILE = path.resolve('./pf_project_url_map.json');

const SOURCE_FIELD_ID = Number(process.env.AMO_SOURCE_FIELD_ID || 703131);
const COMMENT_FIELD_ID = Number(process.env.AMO_COMMENT_FIELD_ID || 1343875);

const PF_FIELD_LEAD_ID = Number(process.env.AMO_PF_FIELD_LEAD_ID || 1516909);
const PF_FIELD_LISTING_REF = Number(process.env.AMO_PF_FIELD_LISTING_REF || 1526392);
const PF_FIELD_LISTING_ID = Number(process.env.AMO_PF_FIELD_LISTING_ID || 1526388);
const PF_FIELD_LISTING_URL = Number(process.env.AMO_PF_FIELD_LISTING_URL || 1526390);
const PF_FIELD_RESPONSE_LINK = Number(process.env.AMO_PF_FIELD_RESPONSE_LINK || 0);
const PF_FIELD_CHANNEL_TYPE = Number(process.env.AMO_PF_FIELD_CHANNEL_TYPE || 1450527);
const PF_FIELD_CATEGORY = Number(process.env.AMO_PF_FIELD_CATEGORY || 1516913);
const PF_FIELD_STATUS = Number(process.env.AMO_PF_FIELD_STATUS || 1516917);

const LOOKBACK_MINUTES = Number(
  process.env.PF_TO_AMO_LOOKBACK_MINUTES
    || (Number(process.env.PF_TO_AMO_LOOKBACK_HOURS || 168) * 60),
);
const MAX_PAGES = Number(process.env.PF_TO_AMO_MAX_PAGES || 200);
const MAX_PER_RUN = Number(process.env.PF_TO_AMO_MAX_PER_RUN || 500);
const DRY_RUN = process.env.PF_TO_AMO_DRY_RUN === '1' || process.argv.includes('--dry-run');

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
    const dir = path.dirname(AMO_TOKENS_FILE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AMO_TOKENS_FILE, JSON.stringify(tokens, null, 2));
  } catch {
    // Runner can be read-only for secrets file; DB persistence is the primary state.
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

  // Add new columns if they don't exist
  try {
    await client.query(`
      ALTER TABLE pf_amo_sync_state
      ADD COLUMN IF NOT EXISTS contact_phone TEXT,
      ADD COLUMN IF NOT EXISTS contact_name TEXT
    `);
  } catch {
    // Columns may already exist, silent fail
  }

  // Add index for contact-based deduplication
  try {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pf_amo_sync_state_contact
      ON pf_amo_sync_state(contact_phone, contact_name)
      WHERE contact_phone IS NOT NULL AND contact_phone != ''
    `);
  } catch {
    // Index may already exist, silent fail
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS pf_amo_sync_cursor (
      source TEXT PRIMARY KEY,
      last_created_at TIMESTAMPTZ NOT NULL,
      last_pf_lead_id TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function readPfSyncCursor(client) {
  const res = await client.query(
    `SELECT last_created_at, last_pf_lead_id FROM pf_amo_sync_cursor WHERE source = 'pf_leads' LIMIT 1`,
  );
  if (!res.rows.length) return null;
  return {
    lastCreatedAt: res.rows[0].last_created_at,
    lastPfLeadId: String(res.rows[0].last_pf_lead_id || ''),
  };
}

async function writePfSyncCursor(client, lastCreatedAt, lastPfLeadId) {
  if (!lastCreatedAt || !lastPfLeadId) return;
  await client.query(
    `
      INSERT INTO pf_amo_sync_cursor(source, last_created_at, last_pf_lead_id, updated_at)
      VALUES ('pf_leads', $1::timestamptz, $2::text, NOW())
      ON CONFLICT (source)
      DO UPDATE SET
        last_created_at = EXCLUDED.last_created_at,
        last_pf_lead_id = EXCLUDED.last_pf_lead_id,
        updated_at = NOW()
    `,
    [lastCreatedAt, String(lastPfLeadId)],
  );
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

async function getPfToken() {
  const apiKey = process.env.PF_API_KEY;
  const apiSecret = process.env.PF_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error('Missing PF_API_KEY or PF_API_SECRET');
  }

  const res = await fetch(`${PF_API_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret }),
  });
  const data = await res.json();
  if (!res.ok || !data?.accessToken) {
    throw new Error(`PF auth failed: ${JSON.stringify(data)}`);
  }
  return data.accessToken;
}

function isLeadAfterCursor(lead, cursor) {
  if (!cursor) return true;

  const createdAt = Date.parse(lead?.createdAt || '');
  if (!Number.isFinite(createdAt)) return false;

  const cursorMs = Date.parse(cursor.lastCreatedAt || '');
  if (!Number.isFinite(cursorMs)) return true;

  if (createdAt > cursorMs) return true;
  if (createdAt < cursorMs) return false;

  const pfLeadId = String(lead?.id || '');
  return pfLeadId > String(cursor.lastPfLeadId || '');
}

async function fetchRecentPfLeads(client) {
  const token = await getPfToken();
  const cutoffMs = Date.now() - LOOKBACK_MINUTES * 60 * 1000;
  const cursor = await readPfSyncCursor(client);
  const out = [];

  let page = 1;
  while (page <= MAX_PAGES) {
    const res = await fetch(`${PF_API_URL}/leads?perPage=50&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`PF leads failed (page ${page}): ${JSON.stringify(data)}`);
    }

    const rows = data.data || data.results || [];
    if (!rows.length) break;

    let olderCount = 0;
    let notAfterCursorCount = 0;
    for (const lead of rows) {
      const createdAtMs = Date.parse(lead?.createdAt || '');
      if (!Number.isFinite(createdAtMs)) continue;

      if (createdAtMs < cutoffMs) {
        olderCount += 1;
        continue;
      }

      if (!isLeadAfterCursor(lead, cursor)) {
        notAfterCursorCount += 1;
        continue;
      }

      if (createdAtMs >= cutoffMs) {
        out.push(lead);
      }
    }

    if (olderCount === rows.length) break;
    if (cursor && notAfterCursorCount === rows.length) break;
    if (!data.pagination?.nextPage) break;
    page = data.pagination.nextPage;
  }

  return out;
}

function normalizePhone(value) {
  return String(value || '').replace(/[^0-9+]/g, '').trim();
}

function normalizeContactName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildContactDedupKey(phone, name) {
  const p = normalizePhone(phone);
  const n = normalizeContactName(name);
  if (!p || !n) return '';
  return `${p}::${n}`;
}

function pickPhone(lead) {
  const contacts = lead?.sender?.contacts || [];
  const phone = contacts.find((c) => String(c?.type || '').toLowerCase() === 'phone');
  return normalizePhone(phone?.value || '');
}

function isProjectLead(pfLead) {
  return String(pfLead?.entityType || '').toLowerCase() === 'project';
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    const out = String(value || '').trim();
    if (out) return out;
  }
  return '';
}

function slugifyPfPathPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildPfProjectDirectUrl(projectId, projectTitle, developerName) {
  const id = firstNonEmptyString(projectId);
  if (id) {
    const override = firstNonEmptyString(PROJECT_URL_OVERRIDES[id]);
    if (override) return override;
  }

  const developerSlug = slugifyPfPathPart(developerName);
  const projectSlug = slugifyPfPathPart(projectTitle);
  if (developerSlug && projectSlug) {
    return `https://www.propertyfinder.ae/en/new-projects/${developerSlug}/${projectSlug}`;
  }

  return '';
}

function buildPfListingUrl(pfLead, projectMeta = null) {
  if (isProjectLead(pfLead)) {
    const projectId = firstNonEmptyString(pfLead?.project?.id);
    const projectTitle = firstNonEmptyString(projectMeta?.title, pfLead?.project?.title, pfLead?.project?.name);
    const projectDeveloper = firstNonEmptyString(
      projectMeta?.developerName,
      pfLead?.project?.developer?.name?.en,
      pfLead?.project?.developer?.name,
      pfLead?.project?.developerName,
    );

    const directProjectUrl = buildPfProjectDirectUrl(projectId, projectTitle, projectDeveloper);
    if (directProjectUrl) return directProjectUrl;

    const projectUrl = firstNonEmptyString(
      pfLead?.project?.url,
      pfLead?.project?.link,
      pfLead?.project?.webUrl,
      pfLead?.project?.pageUrl,
      pfLead?.project?.permalink,
      pfLead?.projectUrl,
      pfLead?.url,
    );
    if (projectUrl) return projectUrl;

    const projectName = firstNonEmptyString(projectTitle, pfLead?.project?.title, pfLead?.project?.name);
    const searchQuery = projectName || projectId;
    if (searchQuery) return `https://www.propertyfinder.ae/en/new-projects?search=${encodeURIComponent(searchQuery)}`;
    return '';
  }
  const listingUrl = firstNonEmptyString(
    pfLead?.listing?.url,
    pfLead?.listing?.link,
    pfLead?.listing?.webUrl,
    pfLead?.listing?.permalink,
    pfLead?.url,
  );
  if (listingUrl) return listingUrl;

  const listingRef = firstNonEmptyString(pfLead?.listing?.reference);
  const listingId = firstNonEmptyString(pfLead?.listing?.id);
  if (listingRef) return `https://www.propertyfinder.ae/en/search?q=${encodeURIComponent(listingRef)}`;
  if (listingId) return `https://www.propertyfinder.ae/en/search?q=${encodeURIComponent(listingId)}`;
  return '';
}

async function lookupProjectMeta(client, projectId) {
  if (!projectId) return null;
  try {
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
      title: res.rows[0]?.title || null,
      developerName: res.rows[0]?.developer_name || null,
    };
  } catch {
    return null;
  }
}

async function getPropertyFinderSourceEnumId(client) {
  if (process.env.AMO_SOURCE_PROPERTY_FINDER_ENUM_ID) {
    return Number(process.env.AMO_SOURCE_PROPERTY_FINDER_ENUM_ID);
  }

  const res = await amoFetch(client, '/api/v4/leads/custom_fields?limit=250');
  if (!res.ok) return null;

  const data = await res.json();
  const fields = data?._embedded?.custom_fields || [];
  const sourceField = fields.find((f) => Number(f.id) === SOURCE_FIELD_ID || String(f.name || '').toLowerCase() === 'источник');
  const enums = sourceField?.enums || [];
  const found = enums.find((e) => /property\s*finder/i.test(String(e?.value || '')));
  return found?.id ? Number(found.id) : null;
}

function buildLeadPayload(pfLead, sourceEnumId, projectMeta = null) {
  const pfLeadId = String(pfLead?.id || '').trim();
  const senderName = String(pfLead?.sender?.name || '').trim();
  const phone = pickPhone(pfLead);
  const channelType = String(pfLead?.channel || pfLead?.type || '').trim();
  const pfStatus = String(pfLead?.status || '').trim();
  const pfCategory = String(pfLead?.entityType || '').trim() || 'listing';
  const isPrimPlus = isProjectLead(pfLead);
  const projectTitle = firstNonEmptyString(projectMeta?.title);

  // For project leads use project.id as the reference identifier
  const listingId = isPrimPlus
    ? String(pfLead?.project?.id || '').trim()
    : (pfLead?.listing?.id ? String(pfLead.listing.id) : '');
  const listingRef = isPrimPlus
    ? String(pfLead?.project?.id || '').trim()
    : (pfLead?.listing?.reference ? String(pfLead.listing.reference) : '');
  const listingUrl = buildPfListingUrl(pfLead, projectMeta);
  const responseLink = firstNonEmptyString(pfLead?.responseLink);

  const customFields = [
    { field_id: PF_FIELD_LEAD_ID, values: [{ value: pfLeadId }] },
    { field_id: PF_FIELD_LISTING_REF, values: [{ value: listingRef || listingId || '' }] },
    { field_id: PF_FIELD_LISTING_ID, values: [{ value: listingId || '' }] },
    { field_id: PF_FIELD_CATEGORY, values: [{ value: pfCategory }] },
    { field_id: PF_FIELD_CHANNEL_TYPE, values: [{ value: channelType }] },
    { field_id: PF_FIELD_STATUS, values: [{ value: pfStatus }] },
    { field_id: PF_FIELD_LISTING_URL, values: [{ value: listingUrl || '' }] },
    {
      field_id: COMMENT_FIELD_ID,
      values: [
        {
          value: [
            isPrimPlus ? 'Type: Primary Plus (Project Lead)' : 'Type: Listing Lead',
            `PF Lead ID: ${pfLeadId}`,
            `Name: ${senderName || '-'}`,
            `Phone: ${phone || '-'}`,
            isPrimPlus ? `Project ID: ${listingId || '-'}` : `Listing ID: ${listingId || '-'}`,
            isPrimPlus ? `Project Title: ${projectTitle || '-'}` : `Listing Ref: ${listingRef || '-'}`,
            `URL: ${listingUrl || '-'}`,
            `Response Link: ${responseLink || '-'}`,
            `Channel: ${channelType || '-'}`,
            `Status: ${pfStatus || '-'}`,
            `CreatedAt: ${pfLead?.createdAt || '-'}`,
          ].join('\n'),
        },
      ],
    },
  ];

  if (sourceEnumId) {
    customFields.unshift({ field_id: SOURCE_FIELD_ID, values: [{ enum_id: sourceEnumId }] });
  }
  if (PF_FIELD_RESPONSE_LINK > 0 && responseLink) {
    customFields.push({ field_id: PF_FIELD_RESPONSE_LINK, values: [{ value: responseLink }] });
  }

  const contact = {
    first_name: senderName || (isPrimPlus ? 'PP Lead' : 'PF Lead'),
    custom_fields_values: [],
  };

  if (phone) {
    contact.custom_fields_values.push({
      field_code: 'PHONE',
      values: [{ value: phone, enum_code: 'WORK' }],
    });
  }

  // Email
  const emailContact = (pfLead?.sender?.contacts || []).find(
    (c) => String(c?.type || '').toLowerCase() === 'email',
  );
  if (emailContact?.value) {
    contact.custom_fields_values.push({
      field_code: 'EMAIL',
      values: [{ value: String(emailContact.value).trim(), enum_code: 'WORK' }],
    });
  }

  const tags = [
    { name: 'property-finder' },
    ...(isPrimPlus ? [{ name: 'primary-plus' }] : []),
  ];

  const leadName = isPrimPlus
    ? `PP: ${senderName || 'Lead'}${projectTitle ? ` | ${projectTitle}` : (listingId ? ` | ${listingId.slice(0, 8)}` : '')}`
    : `PF: ${senderName || 'Lead'}${listingRef ? ` | ${listingRef}` : ''}`;

  const payload = {
    name: leadName,
    pipeline_id: Number(process.env.AMO_PF_PIPELINE_ID || 8696950),
    created_at: Number.isFinite(Date.parse(pfLead?.createdAt || ''))
      ? Math.floor(Date.parse(pfLead.createdAt) / 1000)
      : undefined,
    custom_fields_values: customFields,
    _embedded: {
      contacts: [contact],
      tags,
    },
  };

  return payload;
}

async function createAmoLead(client, pfLead, sourceEnumId) {
  let projectMeta = null;
  if (isProjectLead(pfLead) && pfLead?.project?.id) {
    projectMeta = await lookupProjectMeta(client, pfLead.project.id);
  }
  const body = [buildLeadPayload(pfLead, sourceEnumId, projectMeta)];
  const res = await amoFetch(client, '/api/v4/leads/complex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  const data = parseJsonSafe(text);

  if (!res.ok) {
    throw new Error(`AMO create failed (${res.status}): ${typeof data === 'object' ? JSON.stringify(data) : text}`);
  }

  const row = Array.isArray(data) ? data[0] : data?._embedded?.leads?.[0] || data?.[0];
  const amoLeadId = Number(row?.id);
  if (!Number.isFinite(amoLeadId)) {
    throw new Error(`AMO create returned invalid lead id: ${text.slice(0, 300)}`);
  }

  return { amoLeadId, projectMeta };
}

async function loadAlreadySynced(client, ids) {
  if (!ids.length) return new Set();

  const res = await client.query(
    `SELECT pf_lead_id FROM pf_amo_sync_state WHERE pf_lead_id = ANY($1::text[])`,
    [ids],
  );

  return new Set(res.rows.map((r) => String(r.pf_lead_id)));
}

// Contact-based deduplication: return existing (phone,name) keys from sync state.
async function loadAlreadySyncedByContact(client, leads) {
  const contactLeads = leads.filter((l) => {
    const key = buildContactDedupKey(pickPhone(l), l?.sender?.name || '');
    return Boolean(key);
  });

  if (!contactLeads.length) return new Set();

  const contacts = contactLeads.map((l) => ({
    phone: pickPhone(l),
    name: normalizeContactName(l?.sender?.name || '').slice(0, 255),
  }));

  const placeholders = contacts.map((_, i) => `($${i * 2 + 1}::text, $${i * 2 + 2}::text)`).join(',');
  const params = contacts.flatMap((c) => [c.phone, c.name]);

  const res = await client.query(
    `SELECT DISTINCT contact_phone, contact_name FROM pf_amo_sync_state
     WHERE (contact_phone, contact_name) IN (${placeholders})`,
    params,
  );

  return new Set(
    res.rows
      .map((r) => buildContactDedupKey(r.contact_phone, r.contact_name))
      .filter(Boolean),
  );
}

async function markSynced(client, pfLeadId, amoLeadId, payload, contactPhone, contactName) {
  await client.query(
    `
      INSERT INTO pf_amo_sync_state(pf_lead_id, amo_lead_id, synced_at, payload, contact_phone, contact_name)
      VALUES ($1, $2, NOW(), $3::jsonb, $4, $5)
      ON CONFLICT (pf_lead_id)
      DO UPDATE SET amo_lead_id = EXCLUDED.amo_lead_id, synced_at = NOW(), payload = EXCLUDED.payload, contact_phone = EXCLUDED.contact_phone, contact_name = EXCLUDED.contact_name
    `,
    [String(pfLeadId), Number(amoLeadId), JSON.stringify(payload || {}), contactPhone || null, contactName || null],
  );
}

async function ensureProjectsSnapshotTableExists(client) {
  // Silently check — table may not exist in all environments
  try {
    await client.query(`SELECT 1 FROM pf_projects_snapshot LIMIT 1`);
  } catch {
    // Table doesn't exist — lookupProjectTitle will gracefully return null
  }
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
  await ensureProjectsSnapshotTableExists(client);

  if (DRY_RUN) console.log('[PF->AMO] DRY RUN mode — no leads will be created in AMO');

  try {
    const sourceEnumId = await getPropertyFinderSourceEnumId(client);
    const recentPfLeads = await fetchRecentPfLeads(client);

    const candidates = recentPfLeads
      .filter((l) => l?.id)
      .sort((a, b) => Date.parse(a?.createdAt || '') - Date.parse(b?.createdAt || ''));

    const pfIds = candidates.map((l) => String(l.id));
    const syncedSet = await loadAlreadySynced(client, pfIds);
    const syncedByContactSet = await loadAlreadySyncedByContact(client, candidates);

    let created = 0;
    let skipped = 0;
    let skippedByContact = 0;
    let failed = 0;
    let listingLeads = 0;
    let projectLeads = 0;
    let cursorBlockedByFailure = false;
    let cursorLastCreatedAt = null;
    let cursorLastPfLeadId = '';

    for (const lead of candidates) {
      if (created >= MAX_PER_RUN) break;

      const pfLeadId = String(lead.id);
      
      // Skip if already synced by PF ID
      if (syncedSet.has(pfLeadId)) {
        skipped += 1;
        if (!cursorBlockedByFailure) {
          cursorLastCreatedAt = lead?.createdAt || cursorLastCreatedAt;
          cursorLastPfLeadId = pfLeadId || cursorLastPfLeadId;
        }
        continue;
      }

      const contactPhone = pickPhone(lead);
      const contactName = normalizeContactName(lead?.sender?.name || '').slice(0, 255);
      const contactKey = buildContactDedupKey(contactPhone, contactName);

      // Skip if already synced by contact (phone + name)
      if (contactKey && syncedByContactSet.has(contactKey)) {
        skippedByContact += 1;
        if (!cursorBlockedByFailure) {
          cursorLastCreatedAt = lead?.createdAt || cursorLastCreatedAt;
          cursorLastPfLeadId = pfLeadId || cursorLastPfLeadId;
        }
        continue;
      }

      const isPrimPlus = isProjectLead(lead);
      if (isPrimPlus) projectLeads += 1; else listingLeads += 1;

      if (DRY_RUN) {
        const projectMeta = isPrimPlus ? await lookupProjectMeta(client, lead?.project?.id) : null;
        console.log(`[DRY] ${isPrimPlus ? 'PP' : 'PF'} lead ${pfLeadId} | ${lead?.sender?.name || '-'} | ${isPrimPlus ? (projectMeta?.title || lead?.project?.id || '-') : (lead?.listing?.reference || '-')} | channel=${lead?.channel}`);
        created += 1;
        continue;
      }

      try {
        const { amoLeadId, projectMeta } = await createAmoLead(client, lead, sourceEnumId);
        // Derive created_month: prefer lead.createdAt from PF API, fallback to today
        const createdAtMs = lead?.createdAt ? Date.parse(lead.createdAt) : NaN;
        const createdMonth = Number.isFinite(createdAtMs) && createdAtMs > 0
          ? new Date(createdAtMs).toISOString().slice(0, 7)
          : new Date().toISOString().slice(0, 7);
        
        await markSynced(client, pfLeadId, amoLeadId, {
          createdAt: lead.createdAt || null,
          created_month: createdMonth,
          entityType: lead?.entityType || 'listing',
          listingRef: lead?.listing?.reference || null,
          listingUrl: buildPfListingUrl(lead, projectMeta),
          responseLink: lead?.responseLink || null,
          projectId: lead?.project?.id || null,
          projectTitle: projectMeta?.title || null,
          projectDeveloper: projectMeta?.developerName || null,
          channel: lead?.channel || lead?.type || null,
          senderName: lead?.sender?.name || null,
          senderPhone: contactPhone || null,
        }, contactPhone, contactName);
        if (contactKey) syncedByContactSet.add(contactKey);
        created += 1;
        console.log(`[PF->AMO] Created AMO #${amoLeadId} from PF ${pfLeadId} (${isPrimPlus ? 'primary-plus' : 'listing'})`);

        if (!cursorBlockedByFailure) {
          cursorLastCreatedAt = lead?.createdAt || cursorLastCreatedAt;
          cursorLastPfLeadId = pfLeadId || cursorLastPfLeadId;
        }
      } catch (err) {
        failed += 1;
        cursorBlockedByFailure = true;
        console.error(`[PF->AMO] Failed for PF lead ${pfLeadId}:`, err.message || err);
      }
    }

    if (!DRY_RUN && cursorLastCreatedAt && cursorLastPfLeadId) {
      await writePfSyncCursor(client, cursorLastCreatedAt, cursorLastPfLeadId);
    }

    console.log(JSON.stringify({
      success: true,
      dryRun: DRY_RUN,
      lookbackMinutes: LOOKBACK_MINUTES,
      fetched: recentPfLeads.length,
      candidates: candidates.length,
      listingLeads,
      projectLeads,
      created,
      skipped,
      skippedByContact,
      failed,
      maxPerRun: MAX_PER_RUN,
      sourceEnumId: sourceEnumId || null,
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[PF->AMO] Fatal:', err.message || err);
  process.exit(1);
});
