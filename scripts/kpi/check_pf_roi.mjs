import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function check() {
    const tableId = 'pf_roi_master';
    const [metadata] = await bq.dataset('foryou_analytics').table(tableId).getMetadata();
    console.log('Schema:', JSON.stringify(metadata.schema.fields, null, 2));

    const query = `SELECT * FROM \`crypto-world-epta.foryou_analytics.${tableId}\` LIMIT 3`;
    const [rows] = await bq.query(query);
    console.log('Sample Rows:', JSON.stringify(rows, null, 2));
}

check().catch(console.error);
