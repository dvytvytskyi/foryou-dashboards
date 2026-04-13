import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkPipelines() {
    const query = `
        SELECT pipeline_id, pipeline_name, COUNT(*) as count
        FROM \`crypto-world-epta.foryou_analytics.amo_channel_leads_raw\`
        WHERE source_label = 'Личный лид брокера' 
           OR REGEXP_CONTAINS(LOWER(name), r'личн|партнер|partner')
        GROUP BY 1, 2
        ORDER BY count DESC
    `;
    const [rows] = await bq.query(query);
    console.log(JSON.stringify(rows, null, 2));
}

checkPipelines();
