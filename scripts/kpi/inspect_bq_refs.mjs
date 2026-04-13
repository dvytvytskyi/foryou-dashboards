import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function inspectBqRefs() {
    const query = `
        SELECT listing_ref, pf_deal_type, COUNT(*) as count
        FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\`
        WHERE pf_deal_type = 'project' OR listing_ref NOT LIKE '0%'
        GROUP BY 1, 2
        ORDER BY count DESC
        LIMIT 20
    `;
    const [rows] = await bq.query(query);
    console.log(JSON.stringify(rows, null, 2));
}

inspectBqRefs();
