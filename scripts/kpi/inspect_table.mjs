import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function inspectTable(tableName) {
    try {
        const [metadata] = await bq.dataset('foryou_analytics').table(tableName).getMetadata();
        console.log(`Schema for ${tableName}:`);
        console.log(JSON.stringify(metadata.schema.fields.map(f => f.name), null, 2));
    } catch (e) {
        console.log(`Table ${tableName} not found.`);
    }
}

inspectTable('amo_deals_detailed');
