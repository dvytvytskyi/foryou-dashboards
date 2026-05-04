/**
 * scripts/lib/amo-client.mjs
 *
 * Unified AMO CRM token provider and fetch helper for all scripts.
 *
 * Priority order for tokens:
 *   1. Postgres DB (integration_tokens table) — canonical
 *   2. AMO_TOKENS_JSON env var (CI/GitHub Actions sets this from secret)
 *   3. secrets/amo_tokens.json file (local dev / production server)
 *
 * Exports:
 *   getAmoTokens()          → Promise<{access_token, refresh_token, ...}>
 *   amoFetch(path, opts)    → Promise<Response>   — auto-auth + 401 retry with refresh
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const AMO_DOMAIN = process.env.AMO_DOMAIN || 'reforyou.amocrm.ru';
const AMO_TOKENS_FILE = path.resolve(process.cwd(), 'secrets/amo_tokens.json');
const PROVIDER = 'amo';

// ─── DB helpers ──────────────────────────────────────────────────────────────

function getConnStr() {
  return (
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    null
  );
}

async function readTokensFromDb() {
  const connStr = getConnStr();
  if (!connStr) return null;
  const pool = new pg.Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false }, max: 1 });
  try {
    const res = await pool.query(
      `SELECT tokens FROM integration_tokens WHERE provider = $1 LIMIT 1`,
      [PROVIDER],
    );
    const t = res.rows[0]?.tokens;
    return t?.access_token ? t : null;
  } catch {
    return null;
  } finally {
    await pool.end();
  }
}

async function writeTokensToDb(tokens) {
  const connStr = getConnStr();
  if (!connStr) return;
  const pool = new pg.Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false }, max: 1 });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS integration_tokens (
        provider TEXT PRIMARY KEY,
        tokens JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(
      `INSERT INTO integration_tokens(provider, tokens, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (provider) DO UPDATE SET tokens = EXCLUDED.tokens, updated_at = NOW()`,
      [PROVIDER, JSON.stringify(tokens)],
    );
  } catch (err) {
    console.warn('[amo-client] DB write failed:', err.message);
  } finally {
    await pool.end();
  }
}

// ─── File / env helpers ───────────────────────────────────────────────────────

function readTokensFromFileOrEnv() {
  if (process.env.AMO_TOKENS_JSON) {
    try {
      const t = JSON.parse(process.env.AMO_TOKENS_JSON);
      if (t?.access_token) return t;
    } catch {}
  }
  if (fs.existsSync(AMO_TOKENS_FILE)) {
    try {
      const t = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
      if (t?.access_token) return t;
    } catch {}
  }
  return null;
}

function persistTokensToFile(tokens) {
  try {
    fs.mkdirSync(path.dirname(AMO_TOKENS_FILE), { recursive: true });
    fs.writeFileSync(AMO_TOKENS_FILE, JSON.stringify(tokens, null, 2));
  } catch {}
}

// ─── Token refresh ────────────────────────────────────────────────────────────

async function refreshTokens(currentTokens) {
  const clientId = process.env.AMO_CLIENT_ID;
  const clientSecret = process.env.AMO_CLIENT_SECRET;
  const redirectUri = process.env.AMO_REDIRECT_URI || `https://dashboards.foryou-realestate.com/api/amo/oauth-callback`;

  if (!clientId || !clientSecret) {
    throw new Error('[amo-client] AMO_CLIENT_ID / AMO_CLIENT_SECRET not set — cannot refresh');
  }
  if (!currentTokens?.refresh_token) {
    throw new Error('[amo-client] No refresh_token available');
  }

  const res = await fetch(`https://${AMO_DOMAIN}/oauth2/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: currentTokens.refresh_token,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[amo-client] Token refresh failed ${res.status}: ${body}`);
  }

  const newTokens = await res.json();
  if (!newTokens?.access_token) {
    throw new Error('[amo-client] Refresh response missing access_token');
  }

  await writeTokensToDb(newTokens);
  persistTokensToFile(newTokens);
  console.log('[amo-client] Tokens refreshed and persisted.');
  return newTokens;
}

// ─── Public API ───────────────────────────────────────────────────────────────

let _cachedTokens = null;

/**
 * Returns valid AMO tokens.
 * DB is canonical; falls back to file/env for bootstrap.
 */
export async function getAmoTokens() {
  if (_cachedTokens) return _cachedTokens;

  // 1. Try DB first
  const dbTokens = await readTokensFromDb();
  if (dbTokens) {
    _cachedTokens = dbTokens;
    return dbTokens;
  }

  // 2. Bootstrap from file/env and persist to DB
  const fallback = readTokensFromFileOrEnv();
  if (!fallback) {
    throw new Error('[amo-client] No AMO tokens found in DB, AMO_TOKENS_JSON env, or secrets/amo_tokens.json');
  }

  await writeTokensToDb(fallback);
  _cachedTokens = fallback;
  return fallback;
}

/**
 * Authenticated fetch against AMO API.
 * Automatically retries once with refreshed token on 401.
 *
 * @param {string} urlOrPath  Full URL or path starting with /api/v4/...
 * @param {RequestInit} opts
 */
export async function amoFetch(urlOrPath, opts = {}) {
  const url = urlOrPath.startsWith('http')
    ? urlOrPath
    : `https://${AMO_DOMAIN}${urlOrPath}`;

  let tokens = await getAmoTokens();

  const doFetch = (t) =>
    fetch(url, {
      ...opts,
      headers: {
        'Authorization': `Bearer ${t.access_token}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });

  let res = await doFetch(tokens);

  if (res.status === 401) {
    console.warn('[amo-client] 401 — refreshing token and retrying…');
    _cachedTokens = null;
    tokens = await refreshTokens(tokens);
    _cachedTokens = tokens;
    res = await doFetch(tokens);
  }

  return res;
}
