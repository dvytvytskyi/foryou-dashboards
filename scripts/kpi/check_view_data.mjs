import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkData() {
    const query = 'SELECT tab_source, loss_reason_name, COUNT(*) as count FROM `crypto-world-epta.foryou_analytics.red_efficacy_master` GROUP BY 1, 2 LIMIT 10';
    const [rows] = await bq.query(query);
    console.table(rows);
}

checkData();
