import { BigQuery } from '@google-cloud/bigquery';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getSession } from '@/lib/auth';
import { FRESHNESS_SOURCES, FreshnessSource } from '@/lib/freshnessConfig';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type FreshnessStatus = 'ok' | 'warning' | 'risk' | 'unknown';

type FreshnessRow = {
  id: string;
  kind: 'bigquery' | 'file';
  source: string;
  owner: string;
  expectedRefreshMinutes: number | null;
  lastUpdatedAt: string | null;
  lagMinutes: number | null;
  status: FreshnessStatus;
  error?: string;
};

const bqCredentials = process.env.GOOGLE_AUTH_JSON
  ? JSON.parse(process.env.GOOGLE_AUTH_JSON)
  : undefined;

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  credentials: bqCredentials,
  keyFilename: !bqCredentials ? path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json') : undefined,
});

function statusFromLag(lagMinutes: number | null, expectedRefreshMinutes: number | null): FreshnessStatus {
  if (lagMinutes === null) return 'unknown';
  if (expectedRefreshMinutes === null) return 'unknown';

  if (lagMinutes <= expectedRefreshMinutes * 2) return 'ok';
  if (lagMinutes <= expectedRefreshMinutes * 6) return 'warning';
  return 'risk';
}

function lagMinutesFromDate(date: Date | null): number | null {
  if (!date) return null;
  const ms = Date.now() - date.getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

async function readBqLastModified(source: FreshnessSource): Promise<FreshnessRow> {
  if (source.kind !== 'bigquery') {
    throw new Error('Invalid source kind for readBqLastModified');
  }

  const [dataset, tableId] = source.table.split('.');
  if (!dataset || !tableId) {
    return {
      id: source.id,
      kind: source.kind,
      source: source.table,
      owner: source.owner,
      expectedRefreshMinutes: source.expectedRefreshMinutes,
      lastUpdatedAt: null,
      lagMinutes: null,
      status: 'unknown',
      error: 'Invalid table format, expected dataset.table',
    };
  }

  try {
    const query = `
      SELECT TIMESTAMP_MILLIS(last_modified_time) AS last_modified
      FROM \`crypto-world-epta.${dataset}.__TABLES__\`
      WHERE table_id = @tableId
      LIMIT 1
    `;

    const [rows] = await bq.query({
      query,
      params: { tableId },
      useLegacySql: false,
    });

    const lastUpdatedAtRaw = (rows?.[0] as { last_modified?: string | Date } | undefined)?.last_modified;
    const lastUpdatedDate = lastUpdatedAtRaw ? new Date(lastUpdatedAtRaw) : null;
    const lagMinutes = lagMinutesFromDate(lastUpdatedDate);

    return {
      id: source.id,
      kind: source.kind,
      source: source.table,
      owner: source.owner,
      expectedRefreshMinutes: source.expectedRefreshMinutes,
      lastUpdatedAt: lastUpdatedDate ? lastUpdatedDate.toISOString() : null,
      lagMinutes,
      status: statusFromLag(lagMinutes, source.expectedRefreshMinutes),
    };
  } catch (error) {
    return {
      id: source.id,
      kind: source.kind,
      source: source.table,
      owner: source.owner,
      expectedRefreshMinutes: source.expectedRefreshMinutes,
      lastUpdatedAt: null,
      lagMinutes: null,
      status: 'risk',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readFileLastModified(source: FreshnessSource): Promise<FreshnessRow> {
  if (source.kind !== 'file') {
    throw new Error('Invalid source kind for readFileLastModified');
  }

  try {
    const absolutePath = path.resolve(process.cwd(), source.filePath);
    const stat = await fs.stat(absolutePath);
    const lastUpdatedDate = stat.mtime;
    const lagMinutes = lagMinutesFromDate(lastUpdatedDate);

    return {
      id: source.id,
      kind: source.kind,
      source: source.filePath,
      owner: source.owner,
      expectedRefreshMinutes: source.expectedRefreshMinutes,
      lastUpdatedAt: lastUpdatedDate.toISOString(),
      lagMinutes,
      status: statusFromLag(lagMinutes, source.expectedRefreshMinutes),
    };
  } catch (error) {
    return {
      id: source.id,
      kind: source.kind,
      source: source.filePath,
      owner: source.owner,
      expectedRefreshMinutes: source.expectedRefreshMinutes,
      lastUpdatedAt: null,
      lagMinutes: null,
      status: 'risk',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await Promise.all(
    FRESHNESS_SOURCES.map((source) => {
      if (source.kind === 'bigquery') return readBqLastModified(source);
      return readFileLastModified(source);
    }),
  );

  const summary = {
    total: rows.length,
    ok: rows.filter((r) => r.status === 'ok').length,
    warning: rows.filter((r) => r.status === 'warning').length,
    risk: rows.filter((r) => r.status === 'risk').length,
    unknown: rows.filter((r) => r.status === 'unknown').length,
  };

  return NextResponse.json({
    success: true,
    fetchedAt: new Date().toISOString(),
    summary,
    data: rows,
  });
}
