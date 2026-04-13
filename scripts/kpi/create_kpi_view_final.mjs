import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function createKpiView() {
    console.log('--- Creating FINAL MASTER KPI View in BigQuery ---');
    
    const query = `
        CREATE OR REPLACE VIEW \`crypto-world-epta.foryou_analytics.FORYOU_KPI_FINAL_MASTER\` AS
        WITH lead_facts AS (
          SELECT 
            broker_name,
            DATE_TRUNC(DATE(created_at), MONTH) as month,
            COUNT(*) as actual_leads
          FROM \`crypto-world-epta.foryou_analytics.lead_audit_v3_clean\`
          GROUP BY 1, 2
        ),
        revenue_facts AS (
          SELECT 
            -- Using fuzzy matching or simplified names if needed, but starting with exact
            broker_name,
            DATE_TRUNC(DATE(date), MONTH) as month,
            SUM(gross_commission) as actual_revenue,
            COUNT(*) as actual_deals
          FROM \`crypto-world-epta.foryou_analytics.historical_financials\`
          GROUP BY 1, 2
        ),
        target_facts AS (
          SELECT 
            broker_name,
            month_key as month,
            target_leads,
            target_deals,
            target_revenue,
            crm_quality
          FROM \`crypto-world-epta.foryou_analytics.broker_kpi_targets\`
          -- Take the latest update per broker per month
          QUALIFY ROW_NUMBER() OVER(PARTITION BY broker_name, month_key ORDER BY updated_at DESC) = 1
        )
        SELECT 
          COALESCE(t.broker_name, l.broker_name, r.broker_name) as broker,
          COALESCE(t.month, l.month, r.month) as month,
          
          -- LEADS KPI
          IFNULL(l.actual_leads, 0) as fact_leads,
          IFNULL(t.target_leads, 0) as target_leads,
          ROUND(SAFE_DIVIDE(IFNULL(l.actual_leads, 0), NULLIF(t.target_leads, 0)), 4) as leads_percent,

          -- REVENUE KPI
          IFNULL(r.actual_revenue, 0) as fact_revenue,
          IFNULL(t.target_revenue, 0) as target_revenue,
          ROUND(SAFE_DIVIDE(IFNULL(r.actual_revenue, 0), NULLIF(t.target_revenue, 0)), 4) as revenue_percent,

          -- DEALS KPI
          IFNULL(r.actual_deals, 0) as fact_deals,
          IFNULL(t.target_deals, 0) as target_deals,
          ROUND(SAFE_DIVIDE(IFNULL(r.actual_deals, 0), NULLIF(t.target_deals, 0)), 4) as deals_percent,

          t.crm_quality
          
        FROM target_facts t
        FULL OUTER JOIN lead_facts l ON t.broker_name = l.broker_name AND t.month = l.month
        FULL OUTER JOIN revenue_facts r ON 
            (t.broker_name = r.broker_name OR l.broker_name = r.broker_name OR r.broker_name LIKE CONCAT('%', t.broker_name, '%')) 
            AND (t.month = r.month OR l.month = r.month)
    `;

    await bq.query(query);
    console.log('SUCCESS: BigQuery Master View "FORYOU_KPI_FINAL_MASTER" created.');
}

createKpiView().catch(console.error);
