import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function findNonZero() {
    const query = `
        SELECT crm_lead_id, listing_ref, potential_value
        FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\`
        WHERE crm_status_id = 142 AND potential_value > 0
        LIMIT 10
    `;
    const [rows] = await bq.query(query);
    console.log('Deals with revenue:', rows.length);
    console.log(JSON.stringify(rows, null, 2));
}

findNonZero();
