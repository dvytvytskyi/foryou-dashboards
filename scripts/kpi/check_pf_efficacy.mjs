import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function check() {
    const [metadata] = await bq.dataset('foryou_analytics').table('pf_efficacy_master').getMetadata();
    console.log(JSON.stringify(metadata.schema.fields, null, 2));

    const query = `SELECT * FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\` LIMIT 1`;
    const [rows] = await bq.query(query);
    console.log('Sample Row:', JSON.stringify(rows[0], null, 2));
}

check().catch(console.error);
