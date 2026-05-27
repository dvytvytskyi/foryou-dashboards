import { NextRequest, NextResponse } from 'next/server';
import { createBigQueryClient } from '@/lib/googleAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROXY_SECRET = process.env.BIGQUERY_PROXY_SECRET;

export async function POST(request: NextRequest) {
  if (!PROXY_SECRET) {
    return NextResponse.json(
      { success: false, error: 'BigQuery proxy secret is not configured.' },
      { status: 500 }
    );
  }

  const incomingSecret = request.headers.get('x-bq-proxy-secret');
  if (!incomingSecret || incomingSecret !== PROXY_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { success: false, error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  const query = typeof body.query === 'string' ? body.query : '';
  const params = body.params;
  const useLegacySql = body.useLegacySql === true;

  if (!projectId || !query) {
    return NextResponse.json(
      { success: false, error: 'projectId and query are required.' },
      { status: 400 }
    );
  }

  try {
    const client = createBigQueryClient(projectId);
    const [rows] = await client.query({
      query,
      params,
      useLegacySql,
    });

    const normalizedRows = JSON.parse(JSON.stringify(rows));
    return NextResponse.json({ success: true, rows: normalizedRows });
  } catch (error) {
    console.error('[bigquery-proxy] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BigQuery proxy error',
      },
      { status: 500 }
    );
  }
}
