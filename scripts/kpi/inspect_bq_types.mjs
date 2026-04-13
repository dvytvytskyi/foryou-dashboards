import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function inspectBqTypes() {
    const query = `
        SELECT pf_deal_type, COUNT(*) as count
        FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\`
        GROUP BY 1
    `;
    const [rows] = await bq.query(query);
    console.log(JSON.stringify(rows, null, 2));
}

inspectBqTypes();
