import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkDateRange() {
  const query = `
    SELECT MIN(report_date) as min_date, MAX(report_date) as max_date, COUNT(*) as row_count
    FROM \`crypto-world-epta.foryou_analytics.marketing_v2_leads\`
  `;
  const [rows] = await bq.query(query);
  console.log('Date range in BigQuery:');
  console.log(JSON.stringify(rows[0], null, 2));
}

checkDateRange();
