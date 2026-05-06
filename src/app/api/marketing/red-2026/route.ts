import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'red_leads_raw';

// Фіксований CPL для RED (такий самий як у sync_unified_leads.mjs)
const RED_FIXED_CPL_USD = 58;
const AED_PER_USD = 3.6725;

const RE_QL_DIRECT_STATUSES = [70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802];
const RE_QL_HISTORY_REQUIRED_STATUSES = [70457490, 82310010, 142, 143];
const RE_QL_ACTUAL_DIRECT_STATUSES = [70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802];
const RE_QL_ACTUAL_HISTORY_REQUIRED_STATUSES = [70457490, 142];
const RE_MEETING_STATUSES = [70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802];
// Deals = Документи підписані SPA (70457486) + Post Sales (70757586) + Won (142)
const WON_STATUSES = [142, 70457486, 70757586];

const QL_DIRECT_SQL = RE_QL_DIRECT_STATUSES.join(', ');
const QL_HISTORY_REQUIRED_SQL = RE_QL_HISTORY_REQUIRED_STATUSES.join(', ');
const QL_ACTUAL_DIRECT_SQL = RE_QL_ACTUAL_DIRECT_STATUSES.join(', ');
const QL_ACTUAL_HISTORY_REQUIRED_SQL = RE_QL_ACTUAL_HISTORY_REQUIRED_STATUSES.join(', ');
const MEETING_SQL = RE_MEETING_STATUSES.join(', ');
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

    // Агрегуємо в BQ: tag → utm_source → utm_medium → utm_campaign
    const query = `
      WITH base AS (
        SELECT
          r.*,
          -- For deferred/reanimation/won/lost statuses count as QL only if lead had deeper stage history.
          (m.date_meet IS NOT NULL OR m.date_res IS NOT NULL OR m.date_won IS NOT NULL) AS has_progress_history
        FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\` r
        LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.milestones\` m
          ON SAFE_CAST(m.deal_id AS INT64) = SAFE_CAST(r.lead_id AS INT64)
        WHERE DATE(r.created_at) BETWEEN @startDate AND @endDate
          AND r.tag IN ('RED_RU', 'RED_ENG', 'RED_ARM', 'RED_LUX')
      )
      SELECT
        COALESCE(tag, 'UNKNOWN')                   AS channel,
        CASE WHEN REGEXP_CONTAINS(COALESCE(utm_source,''), r'^(1|0|\\{\\{.*\\}\\})$') THEN '—'
             ELSE COALESCE(utm_source, '—') END     AS level_1,
        CASE WHEN REGEXP_CONTAINS(COALESCE(utm_medium,''), r'^(1|0|\\{\\{.*\\}\\})$') THEN '—'
             ELSE COALESCE(utm_medium, '—') END     AS level_2,
        CASE WHEN REGEXP_CONTAINS(COALESCE(utm_campaign,''), r'^(1|0|\\{\\{.*\\}\\})$') THEN '—'
             ELSE COALESCE(utm_campaign, '—') END   AS level_3,
        COUNT(*)                                    AS leads,
        COUNTIF(
          NOT (
            status_id IN (${QL_DIRECT_SQL})
            OR (status_id IN (${QL_HISTORY_REQUIRED_SQL}) AND has_progress_history)
          )
          AND status_id NOT IN (${WON_SQL})
        )                                           AS no_answer_spam,
        COUNTIF(
          status_id IN (${QL_DIRECT_SQL})
          OR (status_id IN (${QL_HISTORY_REQUIRED_SQL}) AND has_progress_history)
        )                                           AS qualified_leads,
        COUNTIF(
          status_id IN (${QL_ACTUAL_DIRECT_SQL})
          OR (status_id IN (${QL_ACTUAL_HISTORY_REQUIRED_SQL}) AND has_progress_history)
        )                                           AS ql_actual,
        COUNTIF(status_id IN (${MEETING_SQL}))      AS meetings,
        COUNTIF(status_id IN (${WON_SQL}))          AS deals,
        SUM(IF(status_id IN (${WON_SQL}), COALESCE(price, 0), 0))
                                                    AS revenue
      FROM base
      GROUP BY channel, level_1, level_2, level_3
      ORDER BY channel, level_1, level_2, level_3
    `;

    const [bqRows] = await bq.query({
      query,
      params: { startDate, endDate },
    });

    // Перетворюємо в формат DashboardPage
    const TAG_ORDER: Record<string, number> = { RED_RU: 0, RED_ENG: 1, RED_ARM: 2, RED_LUX: 3 };
    const rows = bqRows.map((r: any, i: number) => {
      const leads = Number(r.leads || 0);
      const noAnswerSpam = Number(r.no_answer_spam || 0);
      const ql = Number(r.qualified_leads || 0);
      const meetings = Number(r.meetings || 0);
      const deals = Number(r.deals || 0);
      const revenue = Number(r.revenue || 0);
      const answered = leads - noAnswerSpam;
      const budget = leads * RED_FIXED_CPL_USD * AED_PER_USD;
      const cpl = leads > 0 ? budget / leads : 0;
      const cpql = ql > 0 ? budget / ql : 0;
      const cpMeetings = meetings > 0 ? budget / meetings : 0;
      const cpDeal = deals > 0 ? budget / deals : 0;
      const roi = budget > 0 ? ((revenue - budget) / budget) * 100 : 0;
      return {
        channel: r.channel,
        level_1: r.level_1,
        level_2: r.level_2,
        level_3: r.level_3,
        budget: Math.round(budget),
        date: '-',
        leads,
        cpl: Math.round(cpl),
        no_answer_spam: noAnswerSpam,
        rate_answer: leads > 0 ? Math.round((answered / leads) * 1000) / 10 : 0,
        qualified_leads: ql,
        cost_per_qualified_leads: Math.round(cpql),
        cr_ql: leads > 0 ? Math.round((ql / leads) * 1000) / 10 : 0,
        ql_actual: Number(r.ql_actual || 0),
        cpql_actual: Math.round(cpql),
        meetings,
        cp_meetings: Math.round(cpMeetings),
        deals,
        cost_per_deal: Math.round(cpDeal),
        revenue,
        roi: Math.round(roi * 10) / 10,
        company_revenue: revenue,
        sort_order: (TAG_ORDER[r.channel] ?? 9) * 100000 + i,
      };
    });

    return NextResponse.json({
      success: true,
      data: rows,
      meta: { startDate, endDate, rowCount: rows.length },
    });
  } catch (err) {
    console.error('[red-2026] error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
