import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkProjectRevenue() {
    const query = `
        SELECT listing_ref, potential_value
        FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\`
        WHERE crm_status_id = 142 
        AND (listing_ref IN (SELECT Reference FROM \`crypto-world-epta.foryou_analytics.pf_leads_raw\` WHERE pf_category = 'project'))
    `;
    const [rows] = await bq.query(query);
    console.log('Project deals revenue check:');
    console.log(JSON.stringify(rows, null, 2));
}

checkProjectRevenue();
