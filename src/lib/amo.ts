import fs from 'fs';
import path from 'path';
import { getPostgresPool, isPostgresConfigured } from '@/lib/postgres';

const TOKENS_PATH = path.join(process.cwd(), 'secrets/amo_tokens.json');
const TOKEN_PROVIDER = 'amo';
const REFRESH_SKEW_SECONDS = Number(process.env.AMO_REFRESH_SKEW_SECONDS || 600);
const AMO_MAX_RPS = Math.max(1, Number(process.env.AMO_MAX_RPS || 3));
const AMO_MIN_INTERVAL_MS = Math.ceil(1000 / AMO_MAX_RPS);
const AMO_MAX_429_RETRIES = Math.max(0, Number(process.env.AMO_MAX_429_RETRIES || 4));
const AMO_REQUEST_TIMEOUT_MS = Math.max(3000, Number(process.env.AMO_REQUEST_TIMEOUT_MS || 15000));

type AmoTokens = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  server_time?: number;
  token_type?: string;
  [key: string]: unknown;
};

let ensureTablePromise: Promise<void> | null = null;
let inProcessRefreshPromise: Promise<AmoTokens> | null = null;
let amoRequestChain: Promise<void> = Promise.resolve();
let amoNextAllowedAtMs = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(retryAfterHeader: string | null): number | null {
  if (!retryAfterHeader) return null;

  const seconds = Number(retryAfterHeader);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const dateTs = Date.parse(retryAfterHeader);
  if (!Number.isNaN(dateTs)) {
    const diff = dateTs - Date.now();
    return diff > 0 ? diff : 0;
  }

  return null;
}

function enqueueAmoRequest<T>(task: () => Promise<T>): Promise<T> {
  const run = async () => {
    const now = Date.now();
    const waitMs = Math.max(0, amoNextAllowedAtMs - now);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    amoNextAllowedAtMs = Date.now() + AMO_MIN_INTERVAL_MS;
    return task();
  };

  const result = amoRequestChain.then(run, run);
  amoRequestChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function parseJson(value: string): any | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseJwtPayload(token?: string): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function tokenExpiresAt(tokens: AmoTokens): number | null {
  const payload = parseJwtPayload(tokens.access_token);
  const exp = Number(payload?.exp || 0);
  if (Number.isFinite(exp) && exp > 0) return exp;

  const serverTime = Number(tokens.server_time || 0);
  const expiresIn = Number(tokens.expires_in || 0);
  if (serverTime > 0 && expiresIn > 0) return serverTime + expiresIn;

  return null;
}

function shouldRefresh(tokens: AmoTokens, force: boolean): boolean {
  if (force) return true;
  if (!tokens.access_token) return true;
  const exp = tokenExpiresAt(tokens);
  if (!exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return exp - now <= REFRESH_SKEW_SECONDS;
}

function shouldPreferTokens(candidate: AmoTokens, current: AmoTokens): boolean {
  const candidateExp = tokenExpiresAt(candidate) || 0;
  const currentExp = tokenExpiresAt(current) || 0;
  if (candidateExp !== currentExp) return candidateExp > currentExp;

  const candidateServerTime = Number(candidate.server_time || 0);
  const currentServerTime = Number(current.server_time || 0);
  if (candidateServerTime !== currentServerTime) return candidateServerTime > currentServerTime;

  return Boolean(candidate.access_token) && !current.access_token;
}

export function getAmoDomain(): string {
  const raw = process.env.AMO_DOMAIN || 'reforyou.amocrm.ru';
  return raw.replace(/^https?:\/\//i, '').replace(/\/+$/g, '');
}

async function ensureTokenTable() {
  if (!isPostgresConfigured()) return;
  if (ensureTablePromise) return ensureTablePromise;

  ensureTablePromise = getPostgresPool().query(`
    CREATE TABLE IF NOT EXISTS integration_tokens (
      provider TEXT PRIMARY KEY,
      tokens JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).then(() => undefined);

  return ensureTablePromise;
}

function readTokensFromFile(): AmoTokens {
  const fileJson = fs.readFileSync(TOKENS_PATH, 'utf8');
  const parsedFile = parseJson(fileJson);
  if (!parsedFile || typeof parsedFile !== 'object') {
    throw new Error('Invalid JSON structure in secrets/amo_tokens.json');
  }
  return parsedFile;
}

function readTokensFromEnv(): AmoTokens | null {
  const envJson = process.env.AMO_TOKENS_JSON;
  if (!envJson) return null;
  const parsed = parseJson(envJson);
  if (!parsed || typeof parsed !== 'object') {
    console.error('[AMO] Invalid AMO_TOKENS_JSON in environment');
    return null;
  }
  return parsed;
}

async function readTokensFromPostgres(): Promise<AmoTokens | null> {
  if (!isPostgresConfigured()) return null;
  await ensureTokenTable();
  const res = await getPostgresPool().query<{ tokens: AmoTokens }>(
    `SELECT tokens FROM integration_tokens WHERE provider = $1 LIMIT 1`,
    [TOKEN_PROVIDER],
  );
  return res.rows[0]?.tokens || null;
}

async function writeTokensToPostgres(tokens: AmoTokens): Promise<void> {
  if (!isPostgresConfigured()) return;
  await ensureTokenTable();
  await getPostgresPool().query(
    `
      INSERT INTO integration_tokens(provider, tokens, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (provider)
      DO UPDATE SET tokens = EXCLUDED.tokens, updated_at = NOW()
    `,
    [TOKEN_PROVIDER, JSON.stringify(tokens)],
  );
}

export function readAmoTokens(): { tokens: AmoTokens; fromEnv: boolean } {
  try {
    const parsedFile = readTokensFromFile();
    if (!parsedFile.access_token) {
      console.warn('[AMO] Warning: access_token missing in file tokens');
    }
    return { tokens: parsedFile, fromEnv: false };
  } catch (err: any) {
    const parsed = readTokensFromEnv();
    if (parsed) {
      console.warn('[AMO] Falling back to AMO_TOKENS_JSON from environment');
      return { tokens: parsed, fromEnv: true };
    }

    throw new Error(`[AMO] Failed to read tokens: ${err.message}. Path: ${TOKENS_PATH}`);
  }
}

function persistTokensIfFile(tokens: AmoTokens, fromEnv: boolean) {
  if (fromEnv && !fs.existsSync(TOKENS_PATH)) return;
  try {
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  } catch (err: any) {
    console.warn(`[AMO] Cannot persist tokens to file (${TOKENS_PATH}): ${err.message}`);
  }
}

async function persistTokens(tokens: AmoTokens, fromEnv: boolean) {
  await writeTokensToPostgres(tokens);
  persistTokensIfFile(tokens, fromEnv);
}

async function refreshAmoTokens(
  currentTokens: AmoTokens,
  fromEnv: boolean,
  options?: { persist?: boolean },
): Promise<AmoTokens | null> {
  const clientId = process.env.AMO_CLIENT_ID;
  const clientSecret = process.env.AMO_CLIENT_SECRET;
  const redirectUri = process.env.AMO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri || !currentTokens.refresh_token) {
    console.error('[AMO] Missing refresh credentials:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRedirectUri: !!redirectUri,
      hasRefreshToken: !!currentTokens.refresh_token,
    });
    return null;
  }

  console.log('[AMO] Attempting token refresh...');

  const res = await fetch(`https://${getAmoDomain()}/oauth2/access_token`, {
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
    const errText = await res.text();
    console.error('[AMO] Token refresh failed:', { status: res.status, error: errText });
    return null;
  }

  const refreshed = await res.json();
  console.log('[AMO] Token refreshed successfully');
  const merged = {
    ...currentTokens,
    ...refreshed,
    server_time: Math.floor(Date.now() / 1000),
  };
  if (options?.persist !== false) {
    await persistTokens(merged, fromEnv);
  }
  return merged;
}

async function readTokensPreferDb(): Promise<{ tokens: AmoTokens; fromEnv: boolean }> {
  const dbTokens = await readTokensFromPostgres();
  if (dbTokens && typeof dbTokens === 'object') {
    try {
      const fallback = readAmoTokens();
      if (shouldPreferTokens(fallback.tokens, dbTokens)) {
        if (isPostgresConfigured()) {
          await writeTokensToPostgres(fallback.tokens);
        }
        return fallback;
      }
    } catch {
      // Ignore local fallback read errors when Postgres already has tokens.
    }

    return { tokens: dbTokens, fromEnv: false };
  }

  const fallback = readAmoTokens();
  if (isPostgresConfigured()) {
    await writeTokensToPostgres(fallback.tokens);
  }
  return fallback;
}

async function refreshWithDbLock(forceRefresh: boolean): Promise<AmoTokens> {
  if (!isPostgresConfigured()) {
    const current = readAmoTokens();
    if (!shouldRefresh(current.tokens, forceRefresh)) return current.tokens;
    const refreshed = await refreshAmoTokens(current.tokens, current.fromEnv);
    if (!refreshed) throw new Error('[AMO] Failed to refresh token');
    return refreshed;
  }

  await ensureTokenTable();
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${TOKEN_PROVIDER}_token_lock`]);

    let row = await client.query<{ tokens: AmoTokens }>(
      `SELECT tokens FROM integration_tokens WHERE provider = $1 FOR UPDATE`,
      [TOKEN_PROVIDER],
    );

    if (!row.rows[0]) {
      const fallback = readAmoTokens();
      await client.query(
        `INSERT INTO integration_tokens(provider, tokens, updated_at) VALUES ($1, $2::jsonb, NOW())`,
        [TOKEN_PROVIDER, JSON.stringify(fallback.tokens)],
      );
      row = await client.query<{ tokens: AmoTokens }>(
        `SELECT tokens FROM integration_tokens WHERE provider = $1 FOR UPDATE`,
        [TOKEN_PROVIDER],
      );
    }

    const currentTokens = row.rows[0].tokens;
    if (!shouldRefresh(currentTokens, forceRefresh)) {
      await client.query('COMMIT');
      return currentTokens;
    }

    const refreshed = await refreshAmoTokens(currentTokens, false, { persist: false });
    if (!refreshed) {
      throw new Error('[AMO] Refresh returned empty token set');
    }

    await client.query(
      `UPDATE integration_tokens SET tokens = $2::jsonb, updated_at = NOW() WHERE provider = $1`,
      [TOKEN_PROVIDER, JSON.stringify(refreshed)],
    );
    await client.query('COMMIT');
    return refreshed;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getValidTokens(forceRefresh: boolean): Promise<AmoTokens> {
  const current = await readTokensPreferDb();
  if (!shouldRefresh(current.tokens, forceRefresh)) {
    return current.tokens;
  }

  if (!inProcessRefreshPromise) {
    inProcessRefreshPromise = refreshWithDbLock(forceRefresh).finally(() => {
      inProcessRefreshPromise = null;
    });
  }
  return inProcessRefreshPromise;
}

export async function amoFetch(pathname: string, init?: RequestInit): Promise<Response> {
  const pathOnly = pathname.startsWith('/') ? pathname : `/${pathname}`;
  let tokens: AmoTokens;
  try {
    tokens = await getValidTokens(false);
  } catch (err: any) {
    const message = err?.message || 'Token acquisition failed';
    console.error(`[AMO] Failed to get valid token before request ${pathname}: ${message}`);
    return new Response(JSON.stringify({ error: message }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const doFetch = async (accessToken?: string) => {
    let attempt = 0;
    while (true) {
      const res = await enqueueAmoRequest(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), AMO_REQUEST_TIMEOUT_MS);
        try {
          return await fetch(`https://${getAmoDomain()}${pathOnly}`, {
            ...init,
            signal: controller.signal,
            headers: {
              ...(init?.headers || {}),
              Authorization: `Bearer ${accessToken || ''}`,
            },
          });
        } finally {
          clearTimeout(timeout);
        }
      });

      if (res.status !== 429 || attempt >= AMO_MAX_429_RETRIES) {
        return res;
      }

      const retryAfterMs = parseRetryAfterMs(res.headers.get('retry-after'));
      const backoffMs = retryAfterMs ?? Math.min(1500 * (attempt + 1), 8000);
      console.warn(`[AMO] 429 on ${pathOnly}, retry ${attempt + 1}/${AMO_MAX_429_RETRIES} after ${backoffMs}ms`);
      attempt += 1;
      await sleep(backoffMs);
    }
  };

  let res = await doFetch(tokens.access_token);
  
  if (res.status !== 401) {
    if (!res.ok) {
      console.warn(`[AMO] Non-401 error on ${pathname}: ${res.status}`);
    }
    return res;
  }

  console.warn(`[AMO] Got 401 on ${pathname}, attempting token refresh...`);
  let refreshed: AmoTokens | null = null;
  try {
    refreshed = await getValidTokens(true);
  } catch (err: any) {
    const message = err?.message || 'Token refresh failed';
    console.error(`[AMO] Forced refresh failed on ${pathname}: ${message}`);
    return new Response(JSON.stringify({ error: message }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  if (!refreshed?.access_token) {
    console.error('[AMO] Token refresh failed, returning 401 response');
    return res;
  }

  console.log('[AMO] Retrying request with refreshed token');
  res = await doFetch(refreshed.access_token);
  return res;
}

export async function amoFetchJson<T>(pathname: string, init?: RequestInit): Promise<T> {
  const res = await amoFetch(pathname, init);
  if (res.status === 204) {
    return {} as T;
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[AMO] Request failed ${pathname}: ${res.status} ${err}`);
  }
  return (await res.json()) as T;
}
