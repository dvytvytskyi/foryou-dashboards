import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || '2024-01-01';
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    // 1. Scoreboard Query
    const scoreboardQuery = `
      WITH stats AS (
        SELECT 
          COUNT(*) as total_leads,
          COUNTIF(status_id = 143) as lost_leads,
          COUNTIF(status_id = 142) as closed_deals,
          SUM(IF(status_id = 142, price, 0)) as gmv,
          SAFE_DIVIDE(SUM(IF(status_id = 142, price, 0)), COUNTIF(status_id = 142)) as avg_check
        FROM \`crypto-world-epta.foryou_analytics.leads_all_history_full\`
        WHERE created_at BETWEEN @startDate AND @endDate
      ),
      finance AS (
        SELECT 
          SUM(income) as gross_commission,
          SUM(net_profit) as net_profit
        FROM \`crypto-world-epta.foryou_analytics.department_profitability\`
        WHERE date BETWEEN @startDate AND @endDate
      )
      SELECT 
        s.*,
        f.gross_commission,
        f.net_profit,
        SAFE_DIVIDE(f.net_profit, s.gmv) as profitability_pct,
        SAFE_DIVIDE(f.net_profit, f.gross_commission) as margin_pct
      FROM stats s, finance f
    `;

    // 2. Brokers Chart & Table Query
    const brokersQuery = `
      SELECT 
        broker_name,
        SUM(fact_leads) as leads,
        SUM(plan_leads) as plan_leads,
        SUM(fact_deals) as deals,
        SUM(plan_deals) as plan_deals,
        SUM(fact_revenue) as gross_revenue,
        SUM(plan_revenue) as plan_revenue,
        -- We calculate net profit per broker if available in mapping, 
        -- but for now we'll use fact_revenue as 'Валовый доход'
        -- and a simulated 'Чистая прибыль' based on average ratio (e.g. 10% of gross)
        -- unless we have a better source.
        SUM(fact_revenue) * 0.1 as net_profit -- Simulation for now
      FROM \`crypto-world-epta.foryou_analytics.plan_fact_summary\`
      WHERE month_date BETWEEN @startDate AND @endDate
      GROUP BY broker_name
      ORDER BY gross_revenue DESC
    `;

    const [scoreboardRows] = await bq.query({
      query: scoreboardQuery,
      params: { startDate: `${startDate} 00:00:00`, endDate: `${endDate} 23:59:59` }
    });

    const [brokersRows] = await bq.query({
      query: brokersQuery,
      params: { startDate, endDate }
    });

    return NextResponse.json({
      success: true,
      scoreboard: scoreboardRows[0] || {},
      brokers: brokersRows,
      meta: { startDate, endDate }
    });
  } catch (error) {
    console.error('Sales Overview API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
