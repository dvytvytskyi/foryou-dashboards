import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkColumns() {
    const query = 'SELECT * FROM `crypto-world-epta.foryou_analytics.leads_all_history` LIMIT 1';
    const [rows] = await bq.query(query);
    console.log('Columns in leads_all_history:', Object.keys(rows[0]));
}

checkColumns().catch(console.error);
