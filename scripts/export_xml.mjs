import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config();

const { Pool } = pg;

function getConnectionString() {
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;

  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DB;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const sslMode = (process.env.POSTGRES_SSL_MODE || 'require').toLowerCase();

  if (!host || !database || !user || !password) {
    return null;
  }

  const sslPart = sslMode === 'disable' ? '' : '?sslmode=require';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}${sslPart}`;
}

const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: { rejectUnauthorized: false }
});

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

async function run() {
  try {
    const { rows } = await pool.query("SELECT * FROM pf_listings_snapshot WHERE status = 'live'");
    let xml = '<?xml version="1.0" encoding="utf-8"?>\n<list>\n';
    
    for (const r of rows) {
      const payload = r.payload || {};
      xml += '  <property>\n';
      xml += `    <reference>${escapeXml(r.reference)}</reference>\n`;
      xml += `    <title>${escapeXml(r.title)}</title>\n`;
      xml += `    <category>${escapeXml(r.category)}</category>\n`;
      xml += `    <offering_type>${escapeXml(r.offering_type)}</offering_type>\n`;
      xml += `    <budget>${escapeXml(r.budget)}</budget>\n`;
      xml += `    <group_name>${escapeXml(r.group_name)}</group_name>\n`;
      
      const price = payload.price ? payload.price.value : (payload.priceValue || '');
      xml += `    <price>${escapeXml(price)}</price>\n`;
      
      const location = payload.location?.name || payload.locationName || '';
      xml += `    <location>${escapeXml(location)}</location>\n`;
      
      xml += `    <bedrooms>${escapeXml(payload.bedrooms || '')}</bedrooms>\n`;
      xml += `    <bathrooms>${escapeXml(payload.bathrooms || '')}</bathrooms>\n`;
      xml += `    <size>${escapeXml(payload.size || '')}</size>\n`;
      
      const agent = payload.agent?.name || '';
      xml += `    <agent>${escapeXml(agent)}</agent>\n`;
      xml += `    <url>${escapeXml(payload.shareUrl || '')}</url>\n`;
      
      xml += '  </property>\n';
    }
    
    xml += '</list>';
    fs.writeFileSync('property_finder_units.xml', xml);
    console.log(`Saved property_finder_units.xml with ${rows.length} active listings`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

run();
