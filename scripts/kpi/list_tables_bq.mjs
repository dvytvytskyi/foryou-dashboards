import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function listTables() {
    const [tables] = await bq.dataset('foryou_analytics').getTables();
    console.log('TABLES:', tables.map(t => t.id).join(', '));
}

listTables().catch(console.error);
