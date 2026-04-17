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
          report_date,
          COALESCE(NULLIF(TRIM(level_1), ''), 'Facebook / Target Point') AS source_name,
          leads,
          no_answer_spam,
          qualified_leads,
          ql_actual,
          meetings,
          deals,
          revenue,
          company_revenue
        FROM \`crypto-world-epta.foryou_analytics.marketing_channel_drilldown_daily\`
        WHERE report_date BETWEEN @startDate AND @endDate
          AND channel = 'Facebook'
      )
      SELECT
        'Facebook' AS channel,
        source_name AS level_1,
        'Marketing mart' AS level_2,
        CAST(report_date AS STRING) AS level_3,
        0 AS budget,
        SUM(leads) AS leads,
        0 AS cpl,
        SUM(no_answer_spam) AS no_answer_spam,
        ROUND(SAFE_DIVIDE(SUM(leads) - SUM(no_answer_spam), NULLIF(SUM(leads), 0)) * 100, 2) AS rate_answer,
        SUM(qualified_leads) AS qualified_leads,
        0 AS cost_per_qualified_leads,
        0 AS cr_ql,
        SUM(ql_actual) AS ql_actual,
        0 AS cpql_actual,
        SUM(meetings) AS meetings,
        0 AS cp_meetings,
        SUM(deals) AS deals,
        0 AS cost_per_deal,
        SUM(revenue) AS revenue,
        0 AS roi,
        SUM(company_revenue) AS company_revenue,
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
        source: 'marketing_channel_drilldown_daily',
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
