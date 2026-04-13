import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkPhone() {
    const query = 'SELECT customer_phone FROM `crypto-world-epta.foryou_analytics.pf_leads_raw` LIMIT 10';
    const [rows] = await bq.query(query);
    console.log(rows);
}

checkPhone();
