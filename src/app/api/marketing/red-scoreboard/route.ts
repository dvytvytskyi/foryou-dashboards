import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'red_leads_raw';

const RED_FIXED_CPL_USD = 58;
const AED_PER_USD = 3.6725;

const RE_QL_STATUSES = [70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802, 70457490, 82310010, 142, 143];
const WON_STATUSES = [142, 70457486, 70757586];

const QL_SQL = RE_QL_STATUSES.join(', ');
const WON_SQL = WON_STATUSES.join(', ');

const bqCredentials = process.env.GOOGLE_AUTH_JSON
  ? JSON.parse(process.env.GOOGLE_AUTH_JSON)
  : undefined;

const bq = new BigQuery({
  projectId: PROJECT_ID,
  credentials: bqCredentials,
  keyFilename: !bqCredentials
    ? path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
    : undefined,
});

export async function GET(req: NextRequest) {
  try {
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = req.nextUrl.searchParams;
    const startDate = params.get('startDate') || '2026-01-01';
    const endDate = params.get('endDate') || new Date().toISOString().slice(0, 10);

    const query = `
      SELECT
        COUNT(*) as total_leads,
        COUNTIF(status_id IN (${QL_SQL})) as ql_count,
        SUM(CASE WHEN status_id IN (${QL_SQL}) THEN ${RED_FIXED_CPL_USD} * ${AED_PER_USD} ELSE 0 END) as total_budget,
        SUM(IF(status_id IN (${WON_SQL}), COALESCE(price, 0), 0)) as total_revenue
      FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      WHERE DATE(created_at) BETWEEN @startDate AND @endDate
        AND tag IN ('RED_RU', 'RED_ENG', 'RED_ARM', 'RED_LUX')
    `;

    const [rows] = await bq.query({
      query,
      params: { startDate, endDate },
    });

    const row = rows[0] || {};
    const qlCount = Number(row.ql_count || 0);
    const totalBudget = Number(row.total_budget || 0);
    const totalRevenue = Number(row.total_revenue || 0);

    const cpql = qlCount > 0 ? totalBudget / qlCount : 0;

    return NextResponse.json({
      success: true,
      data: {
        ql: qlCount,
        cpql: Math.round(cpql),
        spend: Math.round(totalBudget),
        revenue: Math.round(totalRevenue),
        qlDeltaUnits: 0,
        cpqlDeltaPct: 0,
        spendDeltaPct: 0,
        revenueDeltaPct: 0,
      },
    });
  } catch (err) {
    console.error('[red-scoreboard] error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
