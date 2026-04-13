import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkAnyRevenue() {
    const query = `
        SELECT crm_lead_id, pf_created_at, potential_value 
        FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\`
        WHERE potential_value > 0
        LIMIT 10
    `;
    const [rows] = await bq.query(query);
    console.log('Leads with potential_value > 0:', rows.length);
    console.log(JSON.stringify(rows, null, 2));
}

checkAnyRevenue();
