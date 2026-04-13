import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkPriceStats() {
    const query = `
        SELECT AVG(price) as avg_price, COUNTIF(price > 0) as non_zero_count, COUNT(*) as total
        FROM \`crypto-world-epta.foryou_analytics.leads_all_history_full\`
        WHERE status_id = 142
    `;
    const [rows] = await bq.query(query);
    console.log(JSON.stringify(rows, null, 2));
}

checkPriceStats();
