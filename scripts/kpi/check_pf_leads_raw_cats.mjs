import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function checkPFLeads() {
    const q = `SELECT pf_category, COUNT(*) as cnt FROM \`${PROJECT_ID}.${DATASET_ID}.pf_leads_raw\` GROUP BY 1`;
    const [rows] = await bq.query(q);
    console.table(rows);
}

checkPFLeads().catch(console.error);
