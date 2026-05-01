import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const AED_PER_USD = 3.6725;
const MAX_FRESHNESS_HOURS = Number(process.env.MAX_MARKETING_FRESHNESS_HOURS || 3);

function asIso(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value?.value === 'string') return value.value;
  return null;
}

function lagHours(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return (Date.now() - ts) / (1000 * 60 * 60);
}

const bqCredentials = process.env.GOOGLE_AUTH_JSON
  ? JSON.parse(process.env.GOOGLE_AUTH_JSON)
  : undefined;

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  credentials: bqCredentials,
  keyFilename: !bqCredentials
    ? path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
    : undefined,
});

export async function GET(request: NextRequest) {
  try {
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const currency = sp.get('currency') || 'aed';
    const startDate = sp.get('startDate') || '2024-01-01';
    const endDate = sp.get('endDate') || new Date().toISOString().split('T')[0];

    const toCurrency = (col: string) =>
      currency === 'usd' ? `SAFE_DIVIDE(${col}, ${AED_PER_USD})` : col;

    const query = `
      SELECT
        report_date,
        channel,
        level_1,
        level_2,
        level_3,
        level_4,
        leads,
        no_answer_spam,
        rate_answer,
        qualified_leads,
        ${toCurrency('budget')}                    AS budget,
        ${toCurrency('cpl')}                       AS cpl,
        ${toCurrency('cost_per_qualified_leads')}  AS cost_per_qualified_leads,
        cr_ql,
        ql_actual,
        ${toCurrency('cpql_actual')}               AS cpql_actual,
        meetings,
        ${toCurrency('cp_meetings')}               AS cp_meetings,
        deals,
        ${toCurrency('cost_per_deal')}             AS cost_per_deal,
        ${toCurrency('revenue')}                   AS revenue,
        roi,
        ${toCurrency('company_revenue')}           AS company_revenue,
        0                                          AS sort_order,
        refreshed_at
      FROM \`crypto-world-epta.foryou_analytics.partners_drilldown_daily\`
      WHERE report_date BETWEEN @startDate AND @endDate
      ORDER BY report_date DESC, leads DESC
    `;

    const [rows] = await bq.query({
      query,
      params: { startDate, endDate },
    });

    // Freshness check
    const lastRefreshedAt = asIso(rows?.[0]?.refreshed_at) ?? null;
    const lag = lagHours(lastRefreshedAt);
    const freshnessError = lag > MAX_FRESHNESS_HOURS
      ? `Partners: stale by ${lag.toFixed(1)}h`
      : null;

    return NextResponse.json({
      success: true,
      data: rows,
      meta: {
        currency,
        startDate,
        endDate,
        rowCount: rows.length,
        fetchedAt: new Date().toISOString(),
        lastUpdatedAt: lastRefreshedAt,
        freshnessError,
      },
    });
  } catch (error) {
    console.error('Partners marketing API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
