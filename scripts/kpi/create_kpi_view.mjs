import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function createKpiView() {
    console.log('--- Creating Unified KPI Master View in BigQuery ---');
    
    // The main logic: 
    // 1. Group leads from leads_all_history
    // 2. Join with targets from broker_kpi_targets
    // 3. Compute all percentages on the fly
    const query = `
        CREATE OR REPLACE VIEW \`crypto-world-epta.foryou_analytics.FORYOU_KPI_FINAL\` AS
        WITH lead_facts AS (
          SELECT 
            responsible_user as broker_name,
            DATE_TRUNC(DATE(created_at), MONTH) as month,
            COUNT(*) as actual_leads
          FROM \`crypto-world-epta.foryou_analytics.leads_all_history\`
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
          COALESCE(t.broker_name, l.broker_name) as broker,
          COALESCE(t.month, l.month) as month,
          
          -- LEADS
          IFNULL(l.actual_leads, 0) as fact_leads,
          IFNULL(t.target_leads, 0) as target_leads,
          CASE WHEN IFNULL(t.target_leads, 0) > 0 THEN l.actual_leads / t.target_leads ELSE 0 END as leads_percent,

          -- REVENUE (Assuming for now we use leads proxy or separate table if it becomes available)
          -- Note: You can add revenue facts here from another table
          IFNULL(t.target_revenue, 0) as target_revenue,
          IFNULL(t.target_deals, 0) as target_deals,
          t.crm_quality
          
        FROM target_facts t
        FULL OUTER JOIN lead_facts l ON t.broker_name = l.broker_name AND t.month = l.month
    `;

    await bq.query(query);
    console.log('SUCCESS: BigQuery View "FORYOU_KPI_FINAL" created.');
}

createKpiView().catch(console.error);
