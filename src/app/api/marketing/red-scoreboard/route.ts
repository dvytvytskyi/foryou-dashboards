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

function getPreviousAnalogRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const days = Math.floor((end.getTime() - start.getTime()) / (24 * 3600 * 1000)) + 1;

  const prevEnd = new Date(start.getTime() - 24 * 3600 * 1000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 24 * 3600 * 1000);

  return {
    prevStartDate: toIsoDate(prevStart),
    prevEndDate: toIsoDate(prevEnd),
  };
}

function percentChange(current: number, previous: number): number {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
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

    const { prevStartDate, prevEndDate } = getPreviousAnalogRange(startDate, endDate);

    const query = `
      WITH current_period AS (
        SELECT
          SUM(qualified_leads) AS ql_total,
          SUM(ql_actual) AS ql_actual_total,
          SUM(budget) AS spend_total,
          SUM(revenue) AS revenue_total
        FROM \`crypto-world-epta.foryou_analytics.marketing_channel_drilldown_daily\`
        WHERE channel = 'RED'
          AND report_date BETWEEN @startDate AND @endDate
      ),
      previous_period AS (
        SELECT
          SUM(qualified_leads) AS ql_total,
          SUM(ql_actual) AS ql_actual_total,
          SUM(budget) AS spend_total,
          SUM(revenue) AS revenue_total
        FROM \`crypto-world-epta.foryou_analytics.marketing_channel_drilldown_daily\`
        WHERE channel = 'RED'
          AND report_date BETWEEN @prevStartDate AND @prevEndDate
      )
      SELECT
        c.ql_total AS current_ql,
        c.ql_actual_total AS current_ql_actual,
        c.spend_total AS current_spend,
        c.revenue_total AS current_revenue,
        p.ql_total AS prev_ql,
        p.ql_actual_total AS prev_ql_actual,
        p.spend_total AS prev_spend,
        p.revenue_total AS prev_revenue
      FROM current_period c CROSS JOIN previous_period p
    `;

    const [rows] = await bq.query({
      query,
      params: { startDate, endDate, prevStartDate, prevEndDate },
      useLegacySql: false,
    });

    const row = (rows?.[0] || {}) as Record<string, number | null | undefined>;

    const currentQl = Number(row.current_ql || 0);
    const currentQlActual = Number(row.current_ql_actual || 0);
    const currentSpend = Number(row.current_spend || 0);
    const currentRevenue = Number(row.current_revenue || 0);

    const prevQl = Number(row.prev_ql || 0);
    const prevQlActual = Number(row.prev_ql_actual || 0);
    const prevSpend = Number(row.prev_spend || 0);
    const prevRevenue = Number(row.prev_revenue || 0);

    const currentCpql = currentQlActual > 0 ? currentSpend / currentQlActual : 0;
    const prevCpql = prevQlActual > 0 ? prevSpend / prevQlActual : 0;

    return NextResponse.json({
      success: true,
      data: {
        ql: currentQl,
        cpql: currentCpql,
        spend: currentSpend,
        revenue: currentRevenue,
        qlDeltaUnits: currentQl - prevQl,
        cpqlDeltaPct: percentChange(currentCpql, prevCpql),
        spendDeltaPct: percentChange(currentSpend, prevSpend),
        revenueDeltaPct: percentChange(currentRevenue, prevRevenue),
      },
      meta: {
        startDate,
        endDate,
        prevStartDate,
        prevEndDate,
      },
    });
  } catch (error) {
    console.error('RED scoreboard API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
