import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE
});

async function countMatched() {
    const query = `
        SELECT 
            count(*) as total, 
            countif(crm_lead_id IS NOT NULL) as matched 
        FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\` 
        WHERE pf_deal_type != 'project'
    `;
    const [rows] = await bq.query(query);
    console.log('--- PF TO CRM MATCHING STATISTICS ---');
    const total = Number(rows[0].total);
    const matched = Number(rows[0].matched);
    const percent = total > 0 ? (matched / total * 100).toFixed(1) : 0;
    
    console.log(`Total Leads: ${total}`);
    console.log(`Matched with CRM: ${matched}`);
    console.log(`Matching Quality: ${percent}%`);
}

countMatched().catch(console.error);
