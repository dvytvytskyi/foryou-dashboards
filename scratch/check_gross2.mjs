import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const client = new Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

const t = await client.query(`
  SELECT COUNT(*) as cnt,
    SUM(CASE WHEN gmv::text != 'NaN' THEN gmv::numeric ELSE 0 END) as gmv,
    SUM(CASE WHEN gross::text != 'NaN' THEN gross::numeric ELSE 0 END) as gross,
    SUM(CASE WHEN net::text != 'NaN' THEN net::numeric ELSE 0 END) as net
  FROM sales_deals_raw
`);
console.log('ALL TIME (no NaN):', JSON.stringify(t.rows[0]));

// Top gross rows all time
const top = await client.query(`
  SELECT deal_date::date, broker, deal_type, gmv, gross, net, source_file
  FROM sales_deals_raw
  WHERE gross::text != 'NaN'
  ORDER BY gross::numeric DESC NULLS LAST
  LIMIT 15
`);
console.log('TOP 15 GROSS:');
top.rows.forEach(r => console.log(JSON.stringify(r)));

await client.end();
