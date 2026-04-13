import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'broker_kpi_targets';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function checkSchema() {
    console.log('Checking BigQuery schema...');
    const [metadata] = await bq.dataset(DATASET_ID).table(TABLE_ID).getMetadata();
    console.log('Schema:', JSON.stringify(metadata.schema.fields, null, 2));
}

checkSchema().catch(console.error);
