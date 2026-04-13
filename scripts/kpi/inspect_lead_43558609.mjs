import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkLead() {
    const query = `
        SELECT lead_id, name, price, status_id, created_at
        FROM \`crypto-world-epta.foryou_analytics.leads_all_history_full\`
        WHERE lead_id = 43558609
        ORDER BY created_at DESC
        LIMIT 5
    `;
    const [rows] = await bq.query(query);
    console.log(JSON.stringify(rows, null, 2));
}

checkLead();
