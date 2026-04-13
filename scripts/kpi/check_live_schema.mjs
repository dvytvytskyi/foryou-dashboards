import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function checkSchema(tableId) {
    console.log(`Checking BigQuery schema of ${tableId}...`);
    const [metadata] = await bq.dataset(DATASET_ID).table(tableId).getMetadata();
    console.log('Schema:', JSON.stringify(metadata.schema.fields, null, 2));
}

const args = process.argv.slice(2);
checkSchema(args[0] || 'leads_all_history_full').catch(console.error);
