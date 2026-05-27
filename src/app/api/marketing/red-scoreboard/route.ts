import { NextRequest, NextResponse } from 'next/server';
import { bigQueryQuery } from '@/lib/bigqueryClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'red_leads_raw';

const RED_FIXED_CPL_USD = 58;
const AED_PER_USD = 3.6725;

const RE_QL_DIRECT_STATUSES = [
  70457466, // квалификация пройдена
  70457470, // презентация назначена
  70457474, // презентация проведена
  70457478, // показ назначен
  70457482, // EOI / чек получен
  70457486, // Документы подписаны (F/SPA)
  70757586, // POST SALES
  142,      // Квартира оплачена
];
const RE_QL_HISTORY_REQUIRED_STATUSES = [
  143,      // Закрыто и не реализовано
];
const WON_STATUSES = [142, 70457486, 70757586];

const QL_DIRECT_SQL = RE_QL_DIRECT_STATUSES.join(', ');
const QL_HISTORY_REQUIRED_SQL = RE_QL_HISTORY_REQUIRED_STATUSES.join(', ');
const WON_SQL = WON_STATUSES.join(', ');

export async function GET(req: NextRequest) {
  try {
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    if (!session) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      console.warn('[red-scoreboard] no session, continuing in non-production mode');
    }

    const params = req.nextUrl.searchParams;
    const startDate = params.get('startDate') || '2026-01-01';
    const endDate = params.get('endDate') || new Date().toISOString().slice(0, 10);

    const query = `
      WITH base AS (
        SELECT
          r.*,
          (m.date_qual IS NOT NULL) AS had_qual
        FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\` r
        LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.milestones\` m
          ON SAFE_CAST(m.deal_id AS INT64) = SAFE_CAST(r.lead_id AS INT64)
        WHERE DATE(r.created_at) BETWEEN @startDate AND @endDate
          AND r.tag IN ('RED_RU', 'RED_ENG', 'RED_ARM', 'RED_LUX')
      )
      SELECT
        COUNT(*) as total_leads,
        SUM(
          CASE
            WHEN status_id IN (${QL_DIRECT_SQL})
              OR (status_id IN (${QL_HISTORY_REQUIRED_SQL}) AND had_qual)
            THEN 1
            ELSE 0
          END
        ) as ql_count,
        SUM(
          CASE
            WHEN status_id IN (${QL_DIRECT_SQL})
              OR (status_id IN (${QL_HISTORY_REQUIRED_SQL}) AND had_qual)
            THEN ${RED_FIXED_CPL_USD} * ${AED_PER_USD}
            ELSE 0
          END
        ) as total_budget,
        SUM(
          CASE
            WHEN status_id IN (${WON_SQL})
            THEN COALESCE(price, 0)
            ELSE 0
          END
        ) as total_revenue
      FROM base
    `;

    const rows = await bigQueryQuery({
      projectId: PROJECT_ID,
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
