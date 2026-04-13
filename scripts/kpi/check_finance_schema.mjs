import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkKpiSchema() {
    console.log('--- CHECKING FINANCIALS SCHEMA ---');
    const [metadata] = await bq.dataset('foryou_analytics').table('historical_financials').getMetadata();
    console.log(JSON.stringify(metadata.schema.fields, null, 2));
}

checkKpiSchema().catch(console.error);
