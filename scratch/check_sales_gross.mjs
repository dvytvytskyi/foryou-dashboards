import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const client = new Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

// Top gross values
const res = await client.query(`
  SELECT deal_date, broker, deal_type, gmv, gross, net, source_label
  FROM sales_deals_raw
  WHERE deal_date >= '2026-03-18'
  ORDER BY (gross::numeric) DESC NULLS LAST
  LIMIT 10
`);
console.log('TOP GROSS ROWS:');
res.rows.forEach(r => console.log(JSON.stringify(r)));

// Totals
const tot = await client.query(`
  SELECT 
    COUNT(*) as cnt,
    SUM(gmv::numeric) as total_gmv,
    SUM(gross::numeric) as total_gross,
    SUM(net::numeric) as total_net
  FROM sales_deals_raw
  WHERE deal_date >= '2026-03-18'
`);
console.log('TOTALS last30d:', JSON.stringify(tot.rows[0]));

// Check source files
const sf = await client.query(`
  SELECT source_file, COUNT(*) as cnt, SUM(gross::numeric) as gross_sum
  FROM sales_deals_raw
  WHERE deal_date >= '2026-03-18'
  GROUP BY source_file ORDER BY gross_sum DESC NULLS LAST
`);
console.log('BY SOURCE FILE:');
sf.rows.forEach(r => console.log(JSON.stringify(r)));

await client.end();
