import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkRows() {
    const query = `
        SELECT level_1, leads, no_answer_spam
        FROM \`crypto-world-epta.foryou_analytics.marketing_v2_leads\`
        WHERE channel = 'Klykov'
        ORDER BY leads DESC
        LIMIT 50
    `;
    const [rows] = await bq.query(query);
    console.log(JSON.stringify(rows, null, 2));
}

checkRows();
