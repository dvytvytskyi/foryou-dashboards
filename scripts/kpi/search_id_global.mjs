import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function searchIDGlobal() {
    // Search in name or utm fields
    const q = `
        SELECT lead_id, name, utm_campaign, utm_content, utm_source, source_label
        FROM \`${PROJECT_ID}.${DATASET_ID}.amo_channel_leads_raw\` 
        WHERE (name LIKE '%9963224%' 
           OR utm_campaign LIKE '%9963224%' 
           OR utm_content LIKE '%9963224%'
           OR CAST(lead_id AS STRING) LIKE '%9963224%')
        LIMIT 10
    `;
    const [rows] = await bq.query(q);
    console.table(rows);
}

searchIDGlobal().catch(console.error);
