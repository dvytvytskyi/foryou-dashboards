import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const AMO_PROVIDER = 'amo';
const TOKENS_PATH = path.resolve('./secrets/amo_tokens.json');

function getConnectionString() {
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;

  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DB;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const sslMode = (process.env.POSTGRES_SSL_MODE || 'require').toLowerCase();

  if (!host || !database || !user || !password) {
    return null;
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

function persistTokensToFile(tokens) {
  fs.mkdirSync(path.dirname(TOKENS_PATH), { recursive: true });
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

async function ensureTokensTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS integration_tokens (
      provider TEXT PRIMARY KEY,
      tokens JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function readDbTokens(client) {
  const row = await client.query(
    `SELECT tokens FROM integration_tokens WHERE provider = $1 LIMIT 1`,
    [AMO_PROVIDER],
  );

  const tokens = row.rows[0]?.tokens;
  return tokens && typeof tokens === 'object' && tokens.access_token ? tokens : null;
}

async function writeDbTokens(client, tokens) {
  await client.query(
    `
      INSERT INTO integration_tokens(provider, tokens, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (provider)
      DO UPDATE SET tokens = EXCLUDED.tokens, updated_at = NOW()
    `,
    [AMO_PROVIDER, JSON.stringify(tokens)],
  );
}

async function main() {
  const connStr = getConnectionString();
  const fallbackTokens = parseJsonSafe(process.env.AMO_TOKENS_JSON || '');
  const sslMode = (process.env.POSTGRES_SSL_MODE || 'require').toLowerCase();

  if (!connStr) {
    if (fallbackTokens?.access_token) {
      persistTokensToFile(fallbackTokens);
      console.log('[bootstrap] AMO tokens loaded from AMO_TOKENS_JSON fallback.');
      return;
    }
    throw new Error('Missing PostgreSQL connection info and AMO_TOKENS_JSON fallback');
  }

  const pool = new pg.Pool({
    connectionString: connStr,
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: false },
    max: 1,
  });

  try {
    await ensureTokensTable(pool);

    let tokens = await readDbTokens(pool);
    let source = 'Postgres';

    if (!tokens) {
      if (!fallbackTokens?.access_token) {
        throw new Error('No AMO tokens found in Postgres and no AMO_TOKENS_JSON fallback provided');
      }
      tokens = fallbackTokens;
      source = 'AMO_TOKENS_JSON fallback';
      await writeDbTokens(pool, tokens);
    }

    persistTokensToFile(tokens);
    console.log(`[bootstrap] AMO tokens loaded from ${source}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[bootstrap] Failed to load AMO tokens:', error.message);
  process.exit(1);
});