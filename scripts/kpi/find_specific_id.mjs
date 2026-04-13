import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function findId() {
    const q = `SELECT listing_ref, COUNT(*) as cnt FROM \`${PROJECT_ID}.${DATASET_ID}.pf_efficacy_master\` WHERE listing_ref LIKE '%9963224%' GROUP BY 1`;
    const [rows] = await bq.query(q);
    console.table(rows);
}

findId().catch(console.error);
