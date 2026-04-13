import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function inspectMarketingView() {
    const [metadata] = await bq.dataset('foryou_analytics').table('marketing_v2_leads').getMetadata();
    if (metadata.type === 'VIEW') {
        console.log('VIEW DEFINITION (marketing_v2_leads):');
        console.log(metadata.view.query);
    } else {
        console.log('TABLE (marketing_v2_leads) - NOT A VIEW');
    }
}

inspectMarketingView();
