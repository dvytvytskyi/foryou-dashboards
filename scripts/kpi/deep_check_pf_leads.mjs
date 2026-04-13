import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function findAnythingWithContent() {
    const q = `SELECT lead_id, name, utm_campaign, utm_content, tags FROM \`${PROJECT_ID}.${DATASET_ID}.amo_channel_leads_raw\` WHERE source_label LIKE '%Property%' AND (utm_content IS NOT NULL OR utm_campaign IS NOT NULL) LIMIT 10`;
    const [rows] = await bq.query(q);
    console.table(rows);
}

// Also let's check what's in 'name'
async function checkNames() {
    const q = `SELECT name, COUNT(*) as cnt FROM \`${PROJECT_ID}.${DATASET_ID}.amo_channel_leads_raw\` WHERE source_label LIKE '%Property%' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`;
    const [rows] = await bq.query(q);
    console.table(rows);
}

findAnythingWithContent().then(checkNames).catch(console.error);
