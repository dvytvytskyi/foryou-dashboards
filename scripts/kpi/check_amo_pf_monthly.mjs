import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function checkMonthlyAmo() {
    const q = `
        SELECT FORMAT_TIMESTAMP('%Y-%m', created_at) as month, COUNT(*) as cnt 
        FROM \`${PROJECT_ID}.${DATASET_ID}.amo_channel_leads_raw\` 
        WHERE source_label LIKE '%Property%'
        GROUP BY 1 ORDER BY 1 DESC
    `;
    const [rows] = await bq.query(q);
    console.table(rows);
}

checkMonthlyAmo().catch(console.error);
