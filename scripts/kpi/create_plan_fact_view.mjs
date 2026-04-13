import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function createPlanFactView() {
    console.log('--- CREATING PLAN-FACT MASTER VIEW ---');
    
    const query = `
        CREATE OR REPLACE VIEW \`crypto-world-epta.foryou_analytics.plan_fact_summary\` AS
        WITH plan AS (
            SELECT 
                DATE_TRUNC(month_key, MONTH) as month,
                broker_name,
                SUM(target_leads) as plan_leads,
                SUM(target_deals) as plan_deals,
                SUM(target_revenue) as plan_revenue
            FROM \`crypto-world-epta.foryou_analytics.google_sheet_kpi_targets\`
            GROUP BY 1, 2
        ),
        fact_leads AS (
            SELECT 
                DATE_TRUNC(DATE(event_time), MONTH) as month,
                broker_name,
                COUNT(*) as fact_leads
            FROM \`crypto-world-epta.foryou_analytics.broker_funnel_events\`
            WHERE event_type = 'lead_added'
            GROUP BY 1, 2
        ),
        fact_deals AS (
            SELECT 
                DATE_TRUNC(date, MONTH) as month,
                broker_name,
                COUNT(*) as fact_deals,
                SUM(gross) as fact_revenue
            FROM \`crypto-world-epta.foryou_analytics.deals_performance_detailed\`
            GROUP BY 1, 2
        ),
        all_keys AS (
            SELECT month, broker_name FROM plan
            UNION DISTINCT
            SELECT month, broker_name FROM fact_leads
            UNION DISTINCT
            SELECT month, broker_name FROM fact_deals
        )
        SELECT 
            k.month as month_date,
            k.broker_name,
            -- LEADS
            CAST(COALESCE(fl.fact_leads, 0) AS INT64) as fact_leads,
            CAST(COALESCE(p.plan_leads, 0) AS INT64) as plan_leads,
            SAFE_DIVIDE(CAST(COALESCE(fl.fact_leads, 0) AS FLOAT64), CAST(NULLIF(p.plan_leads, 0) AS FLOAT64)) as leads_percent,
            
            -- DEALS
            CAST(COALESCE(fd.fact_deals, 0) AS INT64) as fact_deals,
            CAST(COALESCE(p.plan_deals, 0) AS INT64) as plan_deals,
            SAFE_DIVIDE(CAST(COALESCE(fd.fact_deals, 0) AS FLOAT64), CAST(NULLIF(p.plan_deals, 0) AS FLOAT64)) as deals_percent,
            
            -- REVENUE
            CAST(COALESCE(fd.fact_revenue, 0) AS FLOAT64) as fact_revenue,
            CAST(COALESCE(p.plan_revenue, 0) AS FLOAT64) as plan_revenue,
            SAFE_DIVIDE(CAST(COALESCE(fd.fact_revenue, 0) AS FLOAT64), CAST(NULLIF(p.plan_revenue, 0) AS FLOAT64)) as revenue_percent
            
        FROM all_keys k
        LEFT JOIN plan p ON k.month = p.month AND k.broker_name = p.broker_name
        LEFT JOIN fact_leads fl ON k.month = fl.month AND k.broker_name = fl.broker_name
        LEFT JOIN fact_deals fd ON k.month = fd.month AND k.broker_name = fd.broker_name
        ORDER BY month_date DESC
    `;

    await bq.query(query);
    console.log('SUCCESS: Plan-Fact View created.');
}

createPlanFactView().catch(console.error);
