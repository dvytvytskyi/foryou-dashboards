import { Pool, QueryResultRow } from 'pg';

type PostgresGlobal = typeof globalThis & {
  __foryouPgPool?: Pool;
};

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

export function isPostgresConfigured() {
  return Boolean(getConnectionString());
}

export function getPostgresPool() {
  const globalRef = globalThis as PostgresGlobal;
  if (globalRef.__foryouPgPool) return globalRef.__foryouPgPool;

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('PostgreSQL is not configured. Set POSTGRES_URL or POSTGRES_HOST/PORT/DB/USER/PASSWORD.');
  }

  const sslMode = (process.env.POSTGRES_SSL_MODE || 'require').toLowerCase();

  const pool = new Pool({
    connectionString,
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: false },
    max: 10,
  });

  globalRef.__foryouPgPool = pool;
  return pool;
}

export async function queryPostgres<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  const pool = getPostgresPool();
  return pool.query<T>(text, params);
}
