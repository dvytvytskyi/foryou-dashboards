import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkKlykovSpam() {
    // Check raw leads for status 143 in Klykov pipeline
    const query = `
        SELECT name, status_id, COUNT(*) as count
        FROM \`crypto-world-epta.foryou_analytics.amo_channel_leads_raw\`
        WHERE pipeline_id = 10776450 AND status_id = 143
        GROUP BY 1, 2
        ORDER BY count DESC
    `;
    const [rows] = await bq.query(query);
    console.log('Klykov SPAM leads:');
    console.log(JSON.stringify(rows, null, 2));
}

checkKlykovSpam();
