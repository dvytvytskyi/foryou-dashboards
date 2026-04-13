import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkProfitability() {
    console.log('--- FINAL DEPARTMENT PROFITABILITY (Feb 2026) ---');
    const query = `
        SELECT * FROM \`crypto-world-epta.foryou_analytics.department_profitability\`
        WHERE date = "2026-02-01"
        ORDER BY net_profit DESC
    `;
    const [rows] = await bq.query(query);
    console.table(rows);
}

checkProfitability().catch(console.error);
