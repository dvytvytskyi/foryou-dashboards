import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function checkDates() {
    const q = `SELECT MIN(created_at) as min_d, MAX(created_at) as max_d, COUNT(*) as cnt FROM \`${PROJECT_ID}.${DATASET_ID}.pf_leads_raw\``;
    const [rows] = await bq.query(q);
    console.table(rows);
}

checkDates().catch(console.error);
