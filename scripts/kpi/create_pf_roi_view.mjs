import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function createRoiView() {
    console.log('--- CREATING ENRICHED PF ROI VIEW WITH DEAL TYPES ---');

    const viewQuery = `
        CREATE OR REPLACE VIEW \`${PROJECT_ID}.${DATASET_ID}.pf_roi_master\` AS
        WITH spend_data AS (
            SELECT 
                DATE_TRUNC(date, MONTH) as spend_month,
                item_name,
                SUM(amount) as monthly_spend
            FROM \`${PROJECT_ID}.${DATASET_ID}.ГОТОВЫЙ_МАСТЕР_РАСХОДОВ\`
            WHERE item_name = 'PROPERTY FINDER'
            GROUP BY 1, 2
        ),
        leads_data AS (
            SELECT 
                DATE_TRUNC(CAST(pf_created_at AS DATE), MONTH) as lead_month,
                CASE 
                    WHEN crm_status_id IN (142, 143, 70457466, 70457442, 70457446, 70697150) THEN 'Продажа'
                    ELSE 'Продажа' -- Default to Sale for ROI calculation unless we match Rental IDs
                END as lead_category,
                COUNT(customer_phone) as total_leads,
                SUM(is_qualified) as total_qualified,
                SUM(potential_value) as total_potential_revenue
            FROM \`${PROJECT_ID}.${DATASET_ID}.pf_efficacy_master\`
            GROUP BY 1, 2
        )
        SELECT 
            l.lead_month as date,
            'Property Finder' as channel,
            l.lead_category,
            l.total_leads,
            l.total_qualified,
            l.total_potential_revenue,
            COALESCE(s.monthly_spend, 0) as spend,
            SAFE_DIVIDE(COALESCE(s.monthly_spend, 0), l.total_leads) as cpl,
            SAFE_DIVIDE(COALESCE(s.monthly_spend, 0), l.total_qualified) as cpl_qualified,
            SAFE_DIVIDE(l.total_qualified, l.total_leads) * 100 as qual_ratio_percent
        FROM leads_data l
        LEFT JOIN spend_data s ON l.lead_month = s.spend_month
    `;

    await bq.query(viewQuery);
    console.log('SUCCESS: pf_roi_master updated with lead_category.');
}

createRoiView().catch(console.error);
