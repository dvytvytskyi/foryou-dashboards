import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function getViewSql() {
    console.log('--- FETCHING SQL OF department_performance_all ---');
    const [metadata] = await bq.dataset('foryou_analytics').table('department_performance_all').getMetadata();
    console.log(metadata.view.query);
}

getViewSql().catch(console.error);
