import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkKlykovSpam() {
    const query = `
        SELECT name, status_id, COUNT(*) as count
        FROM \`crypto-world-epta.foryou_analytics.leads_all_history_full\`
        WHERE pipeline_id = 10776450
        GROUP BY 1, 2
        ORDER BY count DESC
        LIMIT 20
    `;
    const [rows] = await bq.query(query);
    console.log('Klykov leads statuses:');
    console.log(JSON.stringify(rows, null, 2));
}

checkKlykovSpam();
