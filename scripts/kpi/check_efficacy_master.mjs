import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function checkEfficacySchema() {
    const table = bq.dataset(DATASET_ID).table('pf_efficacy_master');
    const [metadata] = await table.getMetadata();
    console.log('--- SCHEMA ---');
    console.log(JSON.stringify(metadata.schema.fields, null, 2));

    const [rows] = await bq.query('SELECT * FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\` LIMIT 1');
    console.log('--- SAMPLE ROW ---');
    console.log(JSON.stringify(rows[0], null, 2));
}

checkEfficacySchema().catch(console.error);
