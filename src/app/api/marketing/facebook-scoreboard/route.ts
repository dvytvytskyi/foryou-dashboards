import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bqCredentials = process.env.GOOGLE_AUTH_JSON
  ? JSON.parse(process.env.GOOGLE_AUTH_JSON)
  : undefined;

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  credentials: bqCredentials,
  keyFilename: !bqCredentials ? path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json') : undefined,
});

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || '2024-01-01';
    const endDate = searchParams.get('endDate') || toIsoDate(new Date());

    const query = `
      SELECT
        COUNT(*) AS leads_total,
        COUNTIF(status_id IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)) AS ql_total,
        COUNTIF(status_id IN (142, 70457474, 70457478, 70457482, 70457486, 70757586)) AS meetings_total,
        COUNTIF(status_id = 142) AS deals_total,
        SUM(IF(status_id = 142, IFNULL(price, 0), 0)) AS revenue_total
      FROM \`crypto-world-epta.foryou_analytics.amo_channel_leads_raw\`
      WHERE DATE(created_at) BETWEEN @startDate AND @endDate
        AND REGEXP_CONTAINS(LOWER(COALESCE(source_label, '')), r'(facebook|meta|\\bfb\\b)')
    `;

    const [rows] = await bq.query({
      query,
      params: { startDate, endDate },
      useLegacySql: false,
    });

    const row = (rows?.[0] || {}) as Record<string, number | null | undefined>;

    return NextResponse.json({
      success: true,
      data: {
        leads: Number(row.leads_total || 0),
        ql: Number(row.ql_total || 0),
        meetings: Number(row.meetings_total || 0),
        deals: Number(row.deals_total || 0),
        revenue: Number(row.revenue_total || 0),
      },
      meta: { startDate, endDate },
    });
  } catch (error) {
    console.error('Facebook scoreboard API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
