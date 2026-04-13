import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: './secrets/crypto-world-epta-2db29829d55d.json'
});

async function checkSchema() {
    const [metadata] = await bq.dataset('foryou_analytics').table('leads_all_history').getMetadata();
    console.log('SCHEMA:', metadata.schema.fields.map(f => f.name).join(', '));
}

checkSchema().catch(console.error);
