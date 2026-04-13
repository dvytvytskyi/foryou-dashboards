import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function finalizeView() {
    console.log('--- FINALIZING MASTER VIEW WITH ROBUST TYPES ---');
    
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
          QUALIFY ROW_NUMBER() OVER(PARTITION BY broker_name, month_key ORDER BY updated_at DESC) = 1
        ),
        all_keys AS (
          SELECT broker_name, month FROM lead_facts
          UNION DISTINCT
          SELECT broker_name, month FROM revenue_facts
          UNION DISTINCT
          SELECT broker_name, month FROM target_facts
        )
        SELECT 
          CAST(k.broker_name AS STRING) as broker,
          k.month,
          
          -- LEADS
          CAST(IFNULL(l.actual_leads, 0) AS INT64) as fact_leads,
          CAST(IFNULL(t.target_leads, 0) AS INT64) as target_leads,
          
          -- REVENUE
          CAST(IFNULL(r.actual_revenue, 0) AS FLOAT64) as fact_revenue,
          CAST(IFNULL(t.target_revenue, 0) AS FLOAT64) as target_revenue,

          -- DEALS
          CAST(IFNULL(r.actual_deals, 0) AS INT64) as fact_deals,
          CAST(IFNULL(t.target_deals, 0) AS INT64) as target_deals,

          -- CALCULATED % (Already pre-calculated for Looker)
          SAFE_DIVIDE(CAST(IFNULL(l.actual_leads, 0) AS FLOAT64), CAST(NULLIF(t.target_leads, 0) AS FLOAT64)) as leads_percent,
          SAFE_DIVIDE(CAST(IFNULL(r.actual_revenue, 0) AS FLOAT64), CAST(NULLIF(t.target_revenue, 0) AS FLOAT64)) as revenue_percent,
          SAFE_DIVIDE(CAST(IFNULL(r.actual_deals, 0) AS FLOAT64), CAST(NULLIF(t.target_deals, 0) AS FLOAT64)) as deals_percent,

          CAST(t.crm_quality AS STRING) as crm_quality
          
        FROM all_keys k
        LEFT JOIN lead_facts l ON k.broker_name = l.broker_name AND k.month = l.month
        LEFT JOIN revenue_facts r ON k.broker_name = r.broker_name AND k.month = r.month
        LEFT JOIN target_facts t ON k.broker_name = t.broker_name AND k.month = t.month
        WHERE k.broker_name IS NOT NULL
    `;

    await bq.query(query);
    console.log('SUCCESS: Final Master View Refined.');
}

finalizeView().catch(console.error);
