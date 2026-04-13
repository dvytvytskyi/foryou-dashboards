import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function findData() {
    const [tables] = await bq.dataset('foryou_analytics').getTables();
    console.log('Tables in foryou_analytics:', tables.map(t => t.id));
}

findData().catch(console.error);
