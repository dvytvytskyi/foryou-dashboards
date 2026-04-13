import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkAverages() {
    console.log('--- RECAP OF AVERAGE DEALS (Feb 2026) ---');
    const query = `
        SELECT 
            department,
            COUNT(*) as deals,
            AVG(price) as avg_price,
            AVG(gross) as avg_gross,
            AVG(net) as avg_income
        FROM \`crypto-world-epta.foryou_analytics.deals_performance_detailed\`
        GROUP BY department
    `;
    const [rows] = await bq.query(query);
    console.table(rows);
}

checkAverages().catch(console.error);
