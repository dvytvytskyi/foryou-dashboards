import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'historical_financials';
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({ projectId: PROJECT_ID, keyFilename: SERVICE_ACCOUNT_FILE });

async function getStats() {
    console.log('--- Checking Category Distribution ---');
    const query = `SELECT department, COUNT(*) as cnt, SUM(net_company_income) as total_profit FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\` GROUP BY department`;
    const [rows] = await bq.query(query);
    console.log(JSON.stringify(rows, null, 2));
}

getStats().catch(console.error);
