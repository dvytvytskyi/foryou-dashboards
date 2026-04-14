import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE
});

async function checkNoPhone() {
    const query = `
        SELECT 
            pf_category, 
            count(*) as total,
            countif(customer_phone IS NULL) as no_phone
        FROM \`crypto-world-epta.foryou_analytics.pf_leads_raw\` 
        GROUP BY 1
    `;
    const [rows] = await bq.query(query);
    console.log('--- PF LEADS PHONE QUALITY ---');
    rows.forEach(r => {
        const hasPhone = r.total - r.no_phone;
        const pct = (hasPhone / r.total * 100).toFixed(1);
        console.log(`${r.pf_category}: Total ${r.total}, No Phone ${r.no_phone} (${pct}% have phone)`);
    });
}

checkNoPhone().catch(console.error);
