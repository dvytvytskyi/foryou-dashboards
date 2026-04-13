import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function findAnyFields() {
    const q = `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.amo_channel_leads_raw\` WHERE source_label LIKE '%Property%' LIMIT 5`;
    const [rows] = await bq.query(q);
    console.log(JSON.stringify(rows, null, 2));
}

findAnyFields().catch(console.error);
