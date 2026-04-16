const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

async function testQuery() {
  const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
  });

  const query = `
    SELECT * 
    FROM \`crypto-world-epta.foryou_analytics.marketing_channel_drilldown_daily\` 
    LIMIT 1
  `;

  try {
    const [rows] = await bq.query(query);
    console.log('Sample Row from marketing_channel_drilldown_daily:');
    console.log(rows);
  } catch (err) {
    console.error('BQ Error:', err);
  }
}

testQuery();
