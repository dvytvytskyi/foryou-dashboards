import fs from 'fs';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function testLogic() {
    const crmQuery = `
      SELECT 
        listing_ref, 
        COUNTIF(crm_status_id = 143) as spam_count,
        COUNTIF(crm_status_id IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)) as qualified_count
      FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\`
      GROUP BY 1
    `;
    const [bqRows] = await bq.query(crmQuery);
    const withStats = bqRows.filter(r => r.spam_count > 0 || r.qualified_count > 0);
    console.log(`Matched ${withStats.length} references with stats.`);
    
    const projects = JSON.parse(fs.readFileSync('pf_projects_report.json', 'utf8'));
    const matched = projects.filter(p => withStats.some(s => s.listing_ref === p.Reference));
    console.log(`Matched ${matched.length} projects out of ${projects.length}`);
}

testLogic();
