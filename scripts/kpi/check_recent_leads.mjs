import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE
});

async function checkRecent() {
    const q = `
        SELECT count(*) as cnt 
        FROM \`crypto-world-epta.foryou_analytics.pf_leads_raw\` 
        WHERE created_at > '2026-03-30' AND pf_category != 'project'
    `;
    const [rows] = await bq.query(q);
    console.log(`Leads after March 30 (excluding Primary Plus): ${rows[0].cnt}`);
    
    const q2 = `SELECT count(*) as total FROM \`crypto-world-epta.foryou_analytics.pf_leads_raw\` WHERE pf_category != 'project'`;
    const [rows2] = await bq.query(q2);
    console.log(`Total Leads (excluding Primary Plus): ${rows2[0].total}`);
}

checkRecent().catch(console.error);
