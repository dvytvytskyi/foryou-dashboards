import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const client = new Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();
const res = await client.query('SELECT DISTINCT broker FROM sales_deals_raw ORDER BY broker');
res.rows.forEach(r => console.log(JSON.stringify(r.broker)));
await client.end();
