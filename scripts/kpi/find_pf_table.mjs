import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function findTable() {
    const [datasets] = await bq.getDatasets();
    for (const dataset of datasets) {
        console.log(`Dataset: ${dataset.id}`);
        const [tables] = await dataset.getTables();
        for (const table of tables) {
            console.log(`  Table: ${table.id}`);
        }
    }
}

findTable().catch(console.error);
