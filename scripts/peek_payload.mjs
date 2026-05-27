import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}?sslmode=require`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const { rows } = await pool.query("SELECT payload FROM pf_listings_snapshot WHERE status = 'live' LIMIT 1");
  console.log(JSON.stringify(rows[0].payload, null, 2));
  process.exit(0);
}
run();
