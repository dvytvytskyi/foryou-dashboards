import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function verifyJoin() {
    const query = `
        SELECT 
            qual_status,
            COUNT(*) as count,
            SUM(revenue) as total_revenue
        FROM \`crypto-world-epta.foryou_analytics.view_red_efficacy\`
        GROUP BY qual_status
    `;
    const [rows] = await bq.query(query);
    console.log('--- JOIN STATUS SUMMARY ---');
    rows.forEach(r => {
        console.log(`${r.qual_status}: ${r.count} leads (Rev: ${r.total_revenue || 0})`);
    });
}

verifyJoin().catch(console.error);
