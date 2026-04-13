import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkMatches() {
    const query = `
        SELECT 
            COUNT(*) as total_pf_leads,
            COUNT(crm_lead_id) as matched_leads,
            COUNT(CASE WHEN qual_category = 'Qualified' THEN 1 END) as qualified_leads
        FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\`
    `;
    const [rows] = await bq.query(query);
    console.table(rows);
}

checkMatches();
