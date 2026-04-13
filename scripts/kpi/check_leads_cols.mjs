import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function checkCols() {
    const tableId = 'leads_all_history_full';
    const [metadata] = await bq.dataset(DATASET_ID).table(tableId).getMetadata();
    console.log(metadata.schema.fields.map(f => f.name));
}

checkCols().catch(console.error);
