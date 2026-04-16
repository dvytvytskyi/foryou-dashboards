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
      WITH filtered AS (
        SELECT
          DATE(created_at) AS report_date,
          COALESCE(NULLIF(TRIM(source_label), ''), 'Facebook') AS source_name,
          status_id,
          IFNULL(price, 0) AS price
        FROM \`crypto-world-epta.foryou_analytics.amo_channel_leads_raw\`
        WHERE DATE(created_at) BETWEEN @startDate AND @endDate
          AND REGEXP_CONTAINS(LOWER(COALESCE(source_label, '')), r'(facebook|meta|\\bfb\\b)')
      )
      SELECT
        'Facebook' AS channel,
        source_name AS level_1,
        'AmoCRM' AS level_2,
        CAST(report_date AS STRING) AS level_3,
        0 AS budget,
        COUNT(*) AS leads,
        0 AS cpl,
        COUNTIF(status_id = 143) AS no_answer_spam,
        ROUND(SAFE_DIVIDE(COUNT(*) - COUNTIF(status_id = 143), NULLIF(COUNT(*), 0)) * 100, 2) AS rate_answer,
        COUNTIF(status_id IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)) AS qualified_leads,
        0 AS cost_per_qualified_leads,
        0 AS cr_ql,
        COUNTIF(status_id IN (70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)) AS ql_actual,
        0 AS cpql_actual,
        COUNTIF(status_id IN (142, 70457474, 70457478, 70457482, 70457486, 70757586)) AS meetings,
        0 AS cp_meetings,
        COUNTIF(status_id = 142) AS deals,
        0 AS cost_per_deal,
        SUM(IF(status_id = 142, price, 0)) AS revenue,
        0 AS roi,
        ROUND(SUM(IF(status_id = 142, price, 0)) * 0.02, 2) AS company_revenue,
        100 AS sort_order,
        report_date
      FROM filtered
      GROUP BY report_date, source_name
      ORDER BY report_date DESC, source_name ASC
    `;

    const [rows] = await bq.query({
      query,
      params: { startDate, endDate },
      useLegacySql: false,
    });

    return NextResponse.json({
      success: true,
      data: rows,
      meta: {
        source: 'amo_channel_leads_raw',
        startDate,
        endDate,
        rowCount: rows.length,
      },
    });
  } catch (error) {
    console.error('Facebook AmoCRM API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
