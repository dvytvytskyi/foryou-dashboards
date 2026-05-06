import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const AED_PER_USD = 3.6725;
const MAX_FRESHNESS_HOURS = Number(process.env.MAX_MARKETING_FRESHNESS_HOURS || 3);
const PARTNERS_PIPELINE_ID = 8600274;

// Partners pipeline statuses (history-gated logic for deferred/won/lost-like tails)
const PARTNERS_QL_DIRECT_STATUSES = [69778170, 85193922, 85192326];
const PARTNERS_QL_HISTORY_REQUIRED_STATUSES = [85193926, 142, 143];
const PARTNERS_QL_ACTUAL_DIRECT_STATUSES = [69778170, 85193922, 85192326];
const PARTNERS_QL_ACTUAL_HISTORY_REQUIRED_STATUSES = [142];
const PARTNERS_WON_STATUSES = [142];

const PARTNERS_QL_DIRECT_SQL = PARTNERS_QL_DIRECT_STATUSES.join(', ');
const PARTNERS_QL_HISTORY_REQUIRED_SQL = PARTNERS_QL_HISTORY_REQUIRED_STATUSES.join(', ');
const PARTNERS_QL_ACTUAL_DIRECT_SQL = PARTNERS_QL_ACTUAL_DIRECT_STATUSES.join(', ');
const PARTNERS_QL_ACTUAL_HISTORY_REQUIRED_SQL = PARTNERS_QL_ACTUAL_HISTORY_REQUIRED_STATUSES.join(', ');
const PARTNERS_WON_SQL = PARTNERS_WON_STATUSES.join(', ');

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

    const query = `
      WITH latest_amo AS (
        SELECT * EXCEPT(row_num)
        FROM (
          SELECT
            lead_id,
            pipeline_id,
            status_id,
            utm_source,
            utm_medium,
            utm_campaign,
            utm_content,
            price,
            created_at,
            updated_at,
            ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY updated_at DESC) AS row_num
          FROM \`crypto-world-epta.foryou_analytics.amo_channel_leads_raw\`
        )
        WHERE row_num = 1
      ),
      base AS (
        SELECT
          DATE(a.created_at) AS report_date,
          COALESCE(NULLIF(TRIM(a.utm_source), ''), 'Unknown source') AS level_1,
          COALESCE(NULLIF(TRIM(a.utm_medium), ''), 'Unknown medium') AS level_2,
          COALESCE(NULLIF(TRIM(a.utm_campaign), ''), 'Unknown campaign') AS level_3,
          COALESCE(NULLIF(TRIM(a.utm_content), ''), 'Unknown content') AS level_4,
          a.lead_id,
          a.status_id,
          COALESCE(a.price, 0) AS price,
          -- Match RED rule: tail statuses count as QL only if lead had deeper progression.
          (m.date_meet IS NOT NULL OR m.date_res IS NOT NULL OR m.date_won IS NOT NULL) AS has_progress_history
        FROM latest_amo a
        LEFT JOIN \`crypto-world-epta.foryou_analytics.milestones\` m
          ON SAFE_CAST(m.deal_id AS INT64) = SAFE_CAST(a.lead_id AS INT64)
        WHERE a.pipeline_id = ${PARTNERS_PIPELINE_ID}
          AND DATE(a.created_at) BETWEEN @startDate AND @endDate
      ),
      lead_flags AS (
        SELECT
          report_date,
          level_1,
          level_2,
          level_3,
          level_4,
          lead_id,
          status_id,
          price,
          IF(
            status_id IN (${PARTNERS_QL_DIRECT_SQL})
            OR (status_id IN (${PARTNERS_QL_HISTORY_REQUIRED_SQL}) AND has_progress_history),
            1,
            0
          ) AS is_qualified,
          IF(
            status_id IN (${PARTNERS_QL_ACTUAL_DIRECT_SQL})
            OR (status_id IN (${PARTNERS_QL_ACTUAL_HISTORY_REQUIRED_SQL}) AND has_progress_history),
            1,
            0
          ) AS is_ql_actual,
          IF(status_id IN (${PARTNERS_WON_SQL}), 1, 0) AS is_deal,
          IF(status_id IN (${PARTNERS_WON_SQL}), price, 0) AS revenue,
          IF(
            status_id = 143
            AND NOT (status_id IN (${PARTNERS_QL_HISTORY_REQUIRED_SQL}) AND has_progress_history),
            1,
            0
          ) AS is_no_answer_spam
        FROM base
      )
      SELECT
        report_date,
        'Partners leads'                              AS channel,
        level_1,
        level_2,
        level_3,
        level_4,
        COUNT(DISTINCT lead_id)                        AS leads,
        SUM(is_no_answer_spam)                         AS no_answer_spam,
        SAFE_DIVIDE(COUNT(DISTINCT lead_id) - SUM(is_no_answer_spam), NULLIF(COUNT(DISTINCT lead_id), 0)) AS rate_answer,
        SUM(is_qualified)                              AS qualified_leads,
        0.0                                            AS budget,
        0.0                                            AS cpl,
        0.0                                            AS cost_per_qualified_leads,
        SAFE_DIVIDE(SUM(is_qualified), NULLIF(COUNT(DISTINCT lead_id), 0)) AS cr_ql,
        SUM(is_ql_actual)                              AS ql_actual,
        0.0                                            AS cpql_actual,
        0                                              AS meetings,
        0.0                                            AS cp_meetings,
        SUM(is_deal)                                   AS deals,
        0.0                                            AS cost_per_deal,
        ${currency === 'usd' ? `SAFE_DIVIDE(SUM(revenue), ${AED_PER_USD})` : 'SUM(revenue)'} AS revenue,
        0.0                                            AS roi,
        ${currency === 'usd' ? `SAFE_DIVIDE(SUM(revenue), ${AED_PER_USD})` : 'SUM(revenue)'} AS company_revenue,
        0                                          AS sort_order,
        CURRENT_TIMESTAMP()                        AS refreshed_at
      FROM lead_flags
      GROUP BY report_date, level_1, level_2, level_3, level_4
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
