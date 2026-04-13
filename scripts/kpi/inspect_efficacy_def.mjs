import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function inspectTableDef() {
    const [metadata] = await bq.dataset('foryou_analytics').table('pf_efficacy_master').getMetadata();
    if (metadata.type === 'VIEW') {
        console.log('VIEW DEFINITION:');
        console.log(metadata.view.query);
    } else {
        console.log('TABLE (NOT VIEW)');
    }
}

inspectTableDef();
