import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function inspectSchema() {
    const [metadata] = await bq.dataset('foryou_analytics').table('leads_all_history_full').getMetadata();
    console.log(JSON.stringify(metadata.schema.fields, null, 2));
}

inspectSchema();
