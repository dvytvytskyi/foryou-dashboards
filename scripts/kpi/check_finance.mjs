import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkFinancials() {
    const query = 'SELECT * FROM `crypto-world-epta.foryou_analytics.historical_financials` LIMIT 1';
    const [rows] = await bq.query(query);
    console.log('Columns in historical_financials:', Object.keys(rows[0]));
    console.log('Sample data:', rows[0]);
}

checkFinancials().catch(console.error);
