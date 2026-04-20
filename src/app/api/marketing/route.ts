import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_CHANNELS = ['RED', 'Facebook', 'Klykov', 'Website', 'Own leads', 'Partners leads', 'Old leads', 'OKK', 'ETC', 'TOTAL', 'Property Finder'];
const RED_FIXED_CPL_USD = 58;
const RED_FIXED_CPL_AED = 238;
const AED_PER_USD = 3.6725;
const EXCLUDED_RED_LABELS = new Set(['1/ TP_Sell_Oman_(st+vid)_TPFP_RU']);
const EXCLUDED_RED_LEVEL2_PREFIXES = [
  'ST gr_worldwide(kz/ru) TPFP',
  'Video  gr_worldwide(kz/ru) TPFP',
  'ST+video (Radik) gr_worldwide(kz/ru) TPFP',
];

function shouldExcludeRedRow(row: any) {
  const levelValues = [row.level_1, row.level_2, row.level_3]
    .filter((value: unknown): value is string => typeof value === 'string')
    .map((value) => value.trim());

  if (levelValues.some((value) => EXCLUDED_RED_LABELS.has(value))) {
    return true;
  }

  const level2 = typeof row.level_2 === 'string' ? row.level_2.trim() : '';
  return EXCLUDED_RED_LEVEL2_PREFIXES.some((prefix) => level2.startsWith(prefix));
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
    const [rows] = await bq.query({
      query,
      params: {
        startDate,
        endDate,
        channels,
        redFixedCplUsd: RED_FIXED_CPL_USD,
        redFixedCplAed: RED_FIXED_CPL_AED,
        aedPerUsd: AED_PER_USD,
      },
    });

    const filteredRows = rows.filter((row: any) => {
      if (row.channel !== 'RED') return true;
      return !shouldExcludeRedRow(row);
    });

    // Повертаємо JSON відповідь
    return NextResponse.json({
      success: true,
      data: filteredRows,
      meta: {
        currency,
        startDate,
        endDate,
        rowCount: filteredRows.length,
        fetchedAt: new Date().toISOString(),
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
