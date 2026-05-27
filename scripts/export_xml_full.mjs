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

  if (!host || !database || !user || !password) return null;

  const sslPart = sslMode === 'disable' ? '' : '?sslmode=require';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}${sslPart}`;
}

const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: { rejectUnauthorized: false }
});

function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe).replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
    return c;
  });
}

function cdata(unsafe) {
  if (unsafe === null || unsafe === undefined) return '<![CDATA[]]>';
  return `<![CDATA[${String(unsafe).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

async function run() {
  try {
    const { rows } = await pool.query("SELECT * FROM pf_listings_snapshot WHERE status = 'live'");
    let xml = '<?xml version="1.0" encoding="utf-8"?>\n<list>\n';
    
    for (const r of rows) {
      const p = r.payload || {};
      xml += '  <property>\n';
      
      // Basic Info
      xml += `    <id>${escapeXml(p.id || r.listing_id)}</id>\n`;
      xml += `    <reference>${escapeXml(p.reference || r.reference)}</reference>\n`;
      xml += `    <title>${cdata(p.title?.en || p.title || r.title)}</title>\n`;
      xml += `    <description>${cdata(p.description?.en || p.description || '')}</description>\n`;
      xml += `    <category>${escapeXml(p.category || r.category)}</category>\n`;
      xml += `    <offering_type>${escapeXml(p.price?.type || r.offering_type)}</offering_type>\n`;
      
      // Pricing
      const priceVal = p.price?.amounts?.sale || p.price?.amounts?.rent || p.price?.value || r.budget || '';
      xml += `    <price>${escapeXml(priceVal)}</price>\n`;
      
      // Features
      xml += `    <bedrooms>${escapeXml(p.bedrooms || '')}</bedrooms>\n`;
      xml += `    <bathrooms>${escapeXml(p.bathrooms || '')}</bathrooms>\n`;
      xml += `    <size>${escapeXml(p.size || '')}</size>\n`;
      xml += `    <parkingSlots>${escapeXml(p.parkingSlots || '')}</parkingSlots>\n`;
      xml += `    <furnishingType>${escapeXml(p.furnishingType || '')}</furnishingType>\n`;
      
      // Status & Compliance
      xml += `    <projectStatus>${escapeXml(p.projectStatus || '')}</projectStatus>\n`;
      xml += `    <verificationStatus>${escapeXml(p.verificationStatus || '')}</verificationStatus>\n`;
      xml += `    <reraNumber>${escapeXml(p.compliance?.listingAdvertisementNumber || '')}</reraNumber>\n`;
      
      // Location
      xml += `    <emirate>${escapeXml(p.uaeEmirate || '')}</emirate>\n`;
      xml += `    <locationId>${escapeXml(p.location?.id || '')}</locationId>\n`;
      
      // Agent & Team
      const agent = p.assignedTo?.name || p.agent?.name || '';
      xml += `    <agent>${cdata(agent)}</agent>\n`;
      xml += `    <group_name>${escapeXml(r.group_name)}</group_name>\n`;
      
      // URL
      xml += `    <url>${escapeXml(p.shareUrl || '')}</url>\n`;
      
      // Amenities
      if (Array.isArray(p.amenities) && p.amenities.length > 0) {
        xml += `    <amenities>\n`;
        for (const am of p.amenities) {
          xml += `      <amenity>${escapeXml(am)}</amenity>\n`;
        }
        xml += `    </amenities>\n`;
      }
      
      // Images
      if (Array.isArray(p.images) && p.images.length > 0) {
        xml += `    <images>\n`;
        for (const img of p.images) {
          const imgUrl = img.watermarked?.url || img.original?.url || img.url;
          if (imgUrl) {
            xml += `      <image>${escapeXml(imgUrl)}</image>\n`;
          }
        }
        xml += `    </images>\n`;
      }
      
      xml += '  </property>\n';
    }
    
    xml += '</list>';
    fs.writeFileSync('property_finder_units_full.xml', xml);
    console.log(`Saved property_finder_units_full.xml with ${rows.length} active listings and maximum details`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

run();
