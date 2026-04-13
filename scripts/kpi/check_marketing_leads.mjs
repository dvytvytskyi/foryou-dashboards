import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function check() {
  const [metadata] = await bq.dataset('foryou_analytics').table('marketing_v2_leads').getMetadata();
  console.log('Columns:', metadata.schema.fields.map(f => f.name));

  const query = `SELECT * FROM \`crypto-world-epta.foryou_analytics.marketing_v2_leads\` WHERE channel = 'Property Finder' LIMIT 3`;
  const [rows] = await bq.query(query);
  console.log('Sample PF Rows:', JSON.stringify(rows, null, 2));
}

check().catch(console.error);
