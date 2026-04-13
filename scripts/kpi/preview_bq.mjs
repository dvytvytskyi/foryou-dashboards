import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE
});

async function previewData() {
    const query = `SELECT * FROM \`crypto-world-epta.foryou_analytics.pf_leads_raw\` LIMIT 3`;
    const [rows] = await bq.query(query);
    console.log(JSON.stringify(rows, null, 2));
}

previewData().catch(console.error);
