import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE
});

async function countLeads() {
    const query = `
        SELECT 
            pf_category, 
            count(*) as count 
        FROM \`crypto-world-epta.foryou_analytics.pf_leads_raw\` 
        GROUP BY 1
    `;
    const [rows] = await bq.query(query);
    console.log('--- PF LEADS STATISTICS ---');
    let totalExcludingProjects = 0;
    rows.forEach(r => {
        console.log(`${r.pf_category}: ${r.count}`);
        if (r.pf_category !== 'project') {
            totalExcludingProjects += Number(r.count);
        }
    });
    console.log('---------------------------');
    console.log(`TOTAL (excluding Primary Plus): ${totalExcludingProjects}`);
}

countLeads().catch(console.error);
