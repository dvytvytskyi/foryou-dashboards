import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function finalAudit() {
    console.log('--- FINAL DATA AUDIT ---');
    
    // 1. Check Total Matched Leads in Efficacy Master
    const q1 = `SELECT COUNT(*) as total_matched, COUNTIF(crm_lead_id IS NOT NULL) as linked_to_crm FROM \`${PROJECT_ID}.${DATASET_ID}.pf_efficacy_master\``;
    const [res1] = await bq.query(q1);
    console.log(`Efficacy Master: ${res1[0].total_matched} total matched rows, ${res1[0].linked_to_crm} successfully linked to CRM leads.`);

    // 2. Check conversions
    const q2 = `
        SELECT 
            COUNTIF(is_qualified = 1) as qualified,
            COUNTIF(crm_status_id IN (142, 70457474, 70457478, 70457482, 70457486, 70757586)) as meetings,
            COUNTIF(crm_status_id = 142) as deals
        FROM \`${PROJECT_ID}.${DATASET_ID}.pf_efficacy_master\`
    `;
    const [res2] = await bq.query(q2);
    console.table(res2);

    // 3. Check Sell Category Totals
    const q3 = `
        SELECT pf_deal_type, COUNT(*) as cnt, SUM(potential_value) as total_val
        FROM \`${PROJECT_ID}.${DATASET_ID}.pf_efficacy_master\`
        GROUP BY 1
    `;
    const [res3] = await bq.query(q3);
    console.table(res3);
}

finalAudit().catch(console.error);
