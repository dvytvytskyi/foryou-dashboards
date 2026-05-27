import { NextResponse } from 'next/server';
import { queryPostgres, isPostgresConfigured } from '@/lib/postgres';

export const revalidate = 300; // Cache for 5 minutes

function escapeXml(unsafe: any) {
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

function cdata(unsafe: any) {
  if (unsafe === null || unsafe === undefined) return '<![CDATA[]]>';
  return `<![CDATA[${String(unsafe).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

export async function GET() {
  if (!isPostgresConfigured()) {
    return new NextResponse('PostgreSQL is not configured', { status: 503 });
  }

  try {
    const { rows } = await queryPostgres("SELECT * FROM pf_listings_snapshot WHERE status = 'live'");
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
    xml += `<list last_update="${now}">\n`;

    for (const r of rows) {
      const p = r.payload || {};
      const lastUpdate = p.updatedAt ? p.updatedAt.replace('T', ' ').substring(0, 19) : now;
      
      xml += `  <property last_update="${escapeXml(lastUpdate)}">\n`;
      
      // Basic Info
      xml += `    <id>${escapeXml(p.id)}</id>\n`;
      xml += `    <reference_number>${escapeXml(p.reference || r.reference)}</reference_number>\n`;
      xml += `    <property_type>${escapeXml(p.propertyType || p.type || r.type)}</property_type>\n`;
      xml += `    <category>${escapeXml(p.category || r.category)}</category>\n`;
      xml += `    <offer_type>${escapeXml(p.price?.type || r.offering_type)}</offer_type>\n`;
      xml += `    <title>${cdata(p.title?.en || p.title || r.title)}</title>\n`;
      xml += `    <description>${cdata(p.description?.en || p.description || '')}</description>\n`;
      
      // Pricing
      const priceVal = p.price?.amounts?.sale || p.price?.amounts?.rent || p.price?.value || r.budget || '';
      xml += `    <price>${escapeXml(priceVal)}</price>\n`;
      
      // Location Details
      xml += `    <city>${escapeXml(p.uaeEmirate || 'Dubai')}</city>\n`;
      xml += `    <location_id>${escapeXml(p.location?.id || '')}</location_id>\n`;
      xml += `    <community>${escapeXml(p.location?.community || p.locationName || '')}</community>\n`;
      xml += `    <sub_community>${escapeXml(p.location?.subCommunity || '')}</sub_community>\n`;
      xml += `    <building_name>${escapeXml(p.project?.name || p.building?.name || '')}</building_name>\n`;
      xml += `    <unit_number>${escapeXml(p.unit?.number || p.unit_number || '')}</unit_number>\n`;
      
      // Features
      xml += `    <bedroom>${escapeXml(p.bedrooms || '')}</bedroom>\n`;
      xml += `    <bathroom>${escapeXml(p.bathrooms || '')}</bathroom>\n`;
      xml += `    <size>${escapeXml(p.size || '')}</size>\n`;
      xml += `    <parking>${escapeXml(p.parkingSlots || '')}</parking>\n`;
      xml += `    <furnished>${escapeXml(p.furnishingType || '')}</furnished>\n`;
      xml += `    <project_status>${escapeXml(p.projectStatus || '')}</project_status>\n`;
      
      // Dates
      xml += `    <available_from>${escapeXml(p.availableFrom || '')}</available_from>\n`;
      xml += `    <created_at>${escapeXml(p.createdAt || '')}</created_at>\n`;
      xml += `    <updated_at>${escapeXml(p.updatedAt || '')}</updated_at>\n`;
      xml += `    <published_at>${escapeXml(p.portals?.propertyfinder?.publishedAt || '')}</published_at>\n`;
      
      // Compliance & Verification
      xml += `    <verification_status>${escapeXml(p.verificationStatus || '')}</verification_status>\n`;
      xml += `    <rera_license>${escapeXml(p.compliance?.issuingClientLicenseNumber || '')}</rera_license>\n`;
      xml += `    <rera_permit>${escapeXml(p.compliance?.listingAdvertisementNumber || '')}</rera_permit>\n`;
      xml += `    <quality_score>${escapeXml(p.qualityScore?.value || '')}</quality_score>\n`;
      
      // Agent & Team
      const agent = p.assignedTo?.name || p.agent?.name || '';
      xml += `    <agent>\n      <id>${escapeXml(p.assignedTo?.id || '')}</id>\n      <name>${cdata(agent)}</name>\n    </agent>\n`;
      xml += `    <created_by>${cdata(p.createdBy?.name || '')}</created_by>\n`;
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

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=59',
      },
    });
  } catch (error) {
    console.error('Error generating Alnair XML:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
