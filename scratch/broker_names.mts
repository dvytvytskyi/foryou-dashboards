import dotenv from 'dotenv'; dotenv.config();
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.POSTGRES_URL!);
const rows = await sql`SELECT DISTINCT broker FROM sales_deals_raw ORDER BY broker`;
rows.forEach((r: any) => console.log(JSON.stringify(r.broker)));
