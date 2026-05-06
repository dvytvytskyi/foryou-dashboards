import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_CHANNELS = ['RED', 'Facebook', 'Klykov', 'Website', 'Own leads', 'ЮрийНедвижБош', 'Partners leads', 'Old leads', 'OKK', 'ETC', 'TOTAL', 'Property Finder'];
const RED_FIXED_CPL_USD = 58;
const AED_PER_USD = 3.6725;
const RED_RE_QL_DIRECT_STATUSES = [70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802];
const RED_RE_QL_HISTORY_REQUIRED_STATUSES = [70457490, 82310010, 142, 143];
const RED_RE_QL_ACTUAL_DIRECT_STATUSES = [70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802];
const RED_RE_QL_ACTUAL_HISTORY_REQUIRED_STATUSES = [70457490, 142];
const RED_RE_MEETING_STATUSES = [70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802];
const RED_WON_STATUSES = [142, 70457486, 70757586];

const RED_QL_DIRECT_SQL = RED_RE_QL_DIRECT_STATUSES.join(', ');
const RED_QL_HISTORY_REQUIRED_SQL = RED_RE_QL_HISTORY_REQUIRED_STATUSES.join(', ');
const RED_QL_ACTUAL_DIRECT_SQL = RED_RE_QL_ACTUAL_DIRECT_STATUSES.join(', ');
const RED_QL_ACTUAL_HISTORY_REQUIRED_SQL = RED_RE_QL_ACTUAL_HISTORY_REQUIRED_STATUSES.join(', ');
const RED_MEETING_SQL = RED_RE_MEETING_STATUSES.join(', ');
const RED_WON_SQL = RED_WON_STATUSES.join(', ');
const MAX_MARKETING_FRESHNESS_HOURS = Number(process.env.MAX_MARKETING_FRESHNESS_HOURS || 3);
const MAX_RED_FRESHNESS_HOURS = Number(process.env.MAX_RED_FRESHNESS_HOURS || 6);

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

async function loadRedRows(startDate: string, endDate: string) {
  const redQuery = `
    WITH base AS (
      SELECT
        r.*,
        -- For deferred/reanimation/won/lost statuses count as QL only if lead had deeper stage history.
        (m.date_meet IS NOT NULL OR m.date_res IS NOT NULL OR m.date_won IS NOT NULL) AS has_progress_history
      FROM \`crypto-world-epta.foryou_analytics.red_leads_raw\` r
      LEFT JOIN \`crypto-world-epta.foryou_analytics.milestones\` m
        ON SAFE_CAST(m.deal_id AS INT64) = SAFE_CAST(r.lead_id AS INT64)
      WHERE DATE(r.created_at) BETWEEN @startDate AND @endDate
        AND r.tag IN ('RED_RU', 'RED_ENG', 'RED_ARM', 'RED_LUX')
    )
    SELECT
      COALESCE(tag, 'UNKNOWN')                   AS tag,
      CASE WHEN REGEXP_CONTAINS(COALESCE(utm_source,''), r'^(1|0|\\{\\{.*\\}\\})$') THEN '—'
           ELSE COALESCE(utm_source, '—') END     AS level_1,
      CASE WHEN REGEXP_CONTAINS(COALESCE(utm_medium,''), r'^(1|0|\\{\\{.*\\}\\})$') THEN '—'
           ELSE COALESCE(utm_medium, '—') END     AS level_2,
      CASE WHEN REGEXP_CONTAINS(COALESCE(utm_campaign,''), r'^(1|0|\\{\\{.*\\}\\})$') THEN '—'
           ELSE COALESCE(utm_campaign, '—') END   AS level_3,
      COUNT(*)                                    AS leads,
      COUNTIF(
        NOT (
          status_id IN (${RED_QL_DIRECT_SQL})
          OR (status_id IN (${RED_QL_HISTORY_REQUIRED_SQL}) AND has_progress_history)
        )
        AND status_id NOT IN (${RED_WON_SQL})
      )                                           AS no_answer_spam,
      COUNTIF(
        status_id IN (${RED_QL_DIRECT_SQL})
        OR (status_id IN (${RED_QL_HISTORY_REQUIRED_SQL}) AND has_progress_history)
      )                                           AS qualified_leads,
      COUNTIF(
        status_id IN (${RED_QL_ACTUAL_DIRECT_SQL})
        OR (status_id IN (${RED_QL_ACTUAL_HISTORY_REQUIRED_SQL}) AND has_progress_history)
      )                                           AS ql_actual,
      COUNTIF(status_id IN (${RED_MEETING_SQL}))  AS meetings,
      COUNTIF(status_id IN (${RED_WON_SQL}))      AS deals,
      SUM(IF(status_id IN (${RED_WON_SQL}), COALESCE(price, 0), 0))
                                                  AS revenue
    FROM base
    GROUP BY tag, level_1, level_2, level_3
    ORDER BY tag, level_1, level_2, level_3
  `;

  const [redRows] = await bq.query({
    query: redQuery,
    params: { startDate, endDate },
  });

  const TAG_ORDER: Record<string, number> = { RED_RU: 0, RED_ENG: 1, RED_ARM: 2, RED_LUX: 3 };

  return redRows.map((r: any, idx: number) => {
    const leads = Number(r.leads || 0);
    const noAnswerSpam = Number(r.no_answer_spam || 0);
    const qualifiedLeads = Number(r.qualified_leads || 0);
    const meetings = Number(r.meetings || 0);
    const deals = Number(r.deals || 0);
    const revenue = Number(r.revenue || 0);
    const budget = leads * RED_FIXED_CPL_USD * AED_PER_USD;
    const answered = leads - noAnswerSpam;
    const cpqlActualBase = Number(r.ql_actual || 0);
    const tag = String(r.tag || 'UNKNOWN');

    return {
      report_date: null,
      channel: 'RED',
      // Keep RED as one channel in Marketing and show 4 tags as the first dropdown level.
      level_1: tag,
      level_2: r.level_1,
      level_3: `${r.level_2} | ${r.level_3}`,
      budget: Math.round(budget),
      leads,
      cpl: leads > 0 ? Math.round(budget / leads) : 0,
      no_answer_spam: noAnswerSpam,
      rate_answer: leads > 0 ? answered / leads : 0,
      qualified_leads: qualifiedLeads,
      cost_per_qualified_leads: qualifiedLeads > 0 ? Math.round(budget / qualifiedLeads) : 0,
      cr_ql: leads > 0 ? qualifiedLeads / leads : 0,
      ql_actual: cpqlActualBase,
      cpql_actual: cpqlActualBase > 0 ? Math.round(budget / cpqlActualBase) : 0,
      meetings,
      cp_meetings: meetings > 0 ? Math.round(budget / meetings) : 0,
      deals,
      cost_per_deal: deals > 0 ? Math.round(budget / deals) : 0,
      revenue,
      roi: budget > 0 ? revenue / budget : 0,
      company_revenue: revenue,
      sort_order: 1_000_000 + (TAG_ORDER[tag] ?? 9) * 100000 + idx,
    };
  });
}

async function loadRedLastSyncedAt() {
  const [rows] = await bq.query({
    query: `
      SELECT MAX(synced_at) AS last_synced_at
      FROM \`crypto-world-epta.foryou_analytics.red_leads_raw\`
      WHERE tag IN ('RED_RU', 'RED_ENG', 'RED_ARM', 'RED_LUX')
    `,
  });
  return asIso(rows?.[0]?.last_synced_at);
}

async function loadMarketingRefreshedAtByChannel(channels: string[]) {
  if (channels.length === 0) return [] as Array<{ channel: string; last_refreshed_at: string | null }>;

  const [rows] = await bq.query({
    query: `
      SELECT channel, MAX(refreshed_at) AS last_refreshed_at
      FROM \`crypto-world-epta.foryou_analytics.marketing_channel_drilldown_daily\`
      WHERE channel IN UNNEST(@channels)
      GROUP BY channel
    `,
    params: { channels },
  });

  return (rows || []).map((row: any) => ({
    channel: String(row.channel || ''),
    last_refreshed_at: asIso(row.last_refreshed_at),
  }));
}

// Ініціалізуємо BigQuery з сервіс-аккаунтом
const bqCredentials = process.env.GOOGLE_AUTH_JSON 
  ? JSON.parse(process.env.GOOGLE_AUTH_JSON)
  : undefined;

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  credentials: bqCredentials,
  // Fallback for local development if env var is missing
  keyFilename: !bqCredentials ? path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json') : undefined,
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Параметри запиту:
    const currency = searchParams.get('currency') || 'aed'; // валюта: aed або usd
    const startDate = searchParams.get('startDate') || '2024-01-01'; // дата від
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0]; // дата до
    const channelsParam = searchParams.get('channels') || ''; // канали (розділені комою)

    const { getSession } = await import('@/lib/auth');
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Нормалізуємо список каналів і фільтруємо тільки валідні значення.
    const parsedChannels = channelsParam
      ? channelsParam
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : [];
    
    let channels = (parsedChannels.length ? parsedChannels : KNOWN_CHANNELS).filter((ch) => KNOWN_CHANNELS.includes(ch));

    // RBAC: partners only see internal partner leads
    if (session.role === 'partner') {
        if (session.partnerId === 'klykov') {
            channels = ['Klykov'];
        } else {
            channels = ['Partners leads'];
        }
    }

    const includeRed = channels.includes('RED');
    const nonRedChannels = channels.filter((channel) => channel !== 'RED');

    const toCurrency = (col: string) => (currency === 'usd' ? `SAFE_DIVIDE(${col}, @aedPerUsd)` : col);

    const budgetExpr = toCurrency('budget');
    const cplExpr = toCurrency('cpl');
    const cpdExpr = toCurrency('cost_per_deal');
    const cpqlExpr = toCurrency('cost_per_qualified_leads');
    const cpqlActualExpr = toCurrency('cpql_actual');
    const cpMeetingsExpr = toCurrency('cp_meetings');
    const revenueExpr = toCurrency('revenue');
    const companyRevExpr = toCurrency('company_revenue');

    // SQL запит до BigQuery:
    const query = `
      SELECT
        report_date,
        channel,
        level_1,
        level_2,
        level_3,
        ${budgetExpr} as budget,
        leads,
        ${cplExpr} as cpl,
        no_answer_spam,
        rate_answer,
        qualified_leads,
        ${cpqlExpr} as cost_per_qualified_leads,
        cr_ql,
        ql_actual,
        ${cpqlActualExpr} as cpql_actual,
        meetings,
        ${cpMeetingsExpr} as cp_meetings,
        deals,
        ${cpdExpr} as cost_per_deal,
        ${revenueExpr} as revenue,
        roi,
        ${companyRevExpr} as company_revenue,
        sort_order
      FROM \`crypto-world-epta.foryou_analytics.marketing_channel_drilldown_daily\`
      WHERE report_date BETWEEN @startDate AND @endDate
        AND channel IN UNNEST(@channels)
      ORDER BY sort_order ASC, report_date DESC
    `;

    // Виконуємо параметризований запит
    const [rows] = nonRedChannels.length
      ? await bq.query({
          query,
          params: {
            startDate,
            endDate,
            channels: nonRedChannels,
            redFixedCplUsd: RED_FIXED_CPL_USD,
            aedPerUsd: AED_PER_USD,
          },
        })
      : [[]];

    const [redRows, redLastSyncedAt, nonRedRefreshedRows] = await Promise.all([
      includeRed ? loadRedRows(startDate, endDate) : Promise.resolve([]),
      includeRed ? loadRedLastSyncedAt() : Promise.resolve(null),
      loadMarketingRefreshedAtByChannel(nonRedChannels),
    ]);

    const combinedRows = [...rows, ...redRows];

    const freshnessIssues: string[] = [];
    const freshnessTimestamps: string[] = [];

    for (const row of nonRedRefreshedRows) {
      if (!row.last_refreshed_at) {
        freshnessIssues.push(`${row.channel}: missing refreshed_at`);
        continue;
      }
      freshnessTimestamps.push(row.last_refreshed_at);
      const lag = lagHours(row.last_refreshed_at);
      if (lag > MAX_MARKETING_FRESHNESS_HOURS) {
        freshnessIssues.push(`${row.channel}: stale by ${lag.toFixed(1)}h`);
      }
    }

    if (includeRed) {
      if (!redLastSyncedAt) {
        freshnessIssues.push('RED: missing synced_at');
      } else {
        freshnessTimestamps.push(redLastSyncedAt);
        const redLag = lagHours(redLastSyncedAt);
        if (redLag > MAX_RED_FRESHNESS_HOURS) {
          freshnessIssues.push(`RED: stale by ${redLag.toFixed(1)}h`);
        }
      }
    }

    const lastUpdatedAt = freshnessTimestamps.length
      ? freshnessTimestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : null;

    // Повертаємо JSON відповідь
    return NextResponse.json({
      success: true,
      data: combinedRows,
      meta: {
        currency,
        startDate,
        endDate,
        rowCount: combinedRows.length,
        fetchedAt: new Date().toISOString(),
        lastUpdatedAt,
        freshnessError: freshnessIssues.length > 0 ? freshnessIssues.join(' | ') : null,
      },
    });
  } catch (error) {
    console.error('Marketing API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
