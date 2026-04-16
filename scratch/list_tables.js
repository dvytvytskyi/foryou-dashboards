const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

async function listTables() {
  const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
  });

  try {
    const [tables] = await bq.dataset('foryou_analytics').getTables();
    console.log('Tables in foryou_analytics:');
    tables.forEach(table => console.log(`- ${table.id}`));
  } catch (err) {
    console.error('BQ Error:', err);
  }
}

listTables();
