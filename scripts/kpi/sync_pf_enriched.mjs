import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE,
    location: 'europe-central2'
});

const PF_API_KEY = 'OJIlJ.2x35n9PkjxHYTwuN5xI3UsqLxXqUR9c44R';
const PF_API_SECRET = '1mAsFUrBgd0aPFHc6BvGja25DbKe1Bb5';

async function getPFToken() {
    const res = await fetch('https://atlas.propertyfinder.com/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: PF_API_KEY, apiSecret: PF_API_SECRET })
    });
    const data = await res.json();
    return data.accessToken;
}

async function fetchAllListings(token) {
    let allListings = {};
    let page = 1;
    while (true) {
        console.log(`Fetching listings page ${page}...`);
        const res = await fetch(`https://atlas.propertyfinder.com/v1/listings?perPage=100&page=${page}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (!res.ok) break;
        const data = await res.json();
        const listings = data.data || [];
        if (listings.length === 0) break;
        
        listings.forEach(l => {
            // Logic: if price.type is perYear/perMonth, it is Rent. Else Sale.
            const isRent = ['perYear', 'perMonth', 'perWeek', 'perDay'].includes(l.price?.type);
            allListings[l.id] = isRent ? 'Rent' : 'Sale';
        });
        page++;
        if (page > 30) break; // Defensive limit
    }
    return allListings;
}

async function syncPFLeadsWithCategories() {
    console.log('--- SYNCING PF LEADS WITH SALE/RENT CATEGORIES ---');
    try {
        const token = await getPFToken();
        const listingMap = await fetchAllListings(token);
        
        // Fetch Leads (History)
        let allLeads = [];
        for (let page = 1; page <= 15; page++) {
            const res = await fetch(`https://atlas.propertyfinder.com/v1/leads?perPage=50&page=${page}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            if (!res.ok) break;
            const data = await res.json();
            const leads = data.data || [];
            if (leads.length === 0) break;
            allLeads.push(...leads);
        }

        const bqRows = allLeads.map(l => {
            const phoneObj = l.sender?.contacts?.find(c => c.type === 'phone');
            const listingId = l.listing?.id;
            const pfType = listingMap[listingId] || 'Unknown'; // Sale or Rent

            return {
                id: String(l.id),
                type: l.channel || l.type,
                source: l.source || 'Property Finder',
                status: l.status,
                customer_name: l.sender?.name || null,
                customer_phone: phoneObj?.value || null,
                listing_id: String(listingId || ''),
                listing_ref: String(l.listing?.reference || ''),
                pf_category: pfType, // SALE OR RENT
                created_at: l.createdAt,
                updated_at: new Date().toISOString()
            };
        });

        // Load to BigQuery
        const tableId = 'pf_leads_raw';
        const table = bq.dataset(DATASET_ID).table(tableId);

        // Update schema to include pf_category
        await table.setMetadata({
            schema: {
                fields: [
                    { name: 'id', type: 'STRING' },
                    { name: 'type', type: 'STRING' },
                    { name: 'source', type: 'STRING' },
                    { name: 'status', type: 'STRING' },
                    { name: 'customer_name', type: 'STRING' },
                    { name: 'customer_phone', type: 'STRING' },
                    { name: 'listing_id', type: 'STRING' },
                    { name: 'listing_ref', type: 'STRING' },
                    { name: 'pf_category', type: 'STRING' },
                    { name: 'created_at', type: 'TIMESTAMP' },
                    { name: 'updated_at', type: 'TIMESTAMP' }
                ]
            }
        });

        const resultsJson = bqRows.map(r => JSON.stringify(r)).join('\n');
        const tempFile = path.resolve('./foryou-kpi/tmp_pf_leads.json');
        const fs = await import('fs');
        fs.writeFileSync(tempFile, resultsJson);

        const schema = {
            fields: [
                { name: 'id', type: 'STRING' },
                { name: 'type', type: 'STRING' },
                { name: 'source', type: 'STRING' },
                { name: 'status', type: 'STRING' },
                { name: 'customer_name', type: 'STRING' },
                { name: 'customer_phone', type: 'STRING' },
                { name: 'customer_email', type: 'STRING' },
                { name: 'listing_id', type: 'STRING' },
                { name: 'listing_ref', type: 'STRING' },
                { name: 'pf_category', type: 'STRING' },
                { name: 'created_at', type: 'TIMESTAMP' },
                { name: 'updated_at', type: 'TIMESTAMP' }
            ]
        };

        await table.load(tempFile, {
            sourceFormat: 'NEWLINE_DELIMITED_JSON',
            writeDisposition: 'WRITE_TRUNCATE',
            schema: schema
        });

        console.log(`SUCCESS: ${bqRows.length} enriched leads synced.`);
    } catch (e) {
        console.error('SYNC ERROR:', e);
    }
}

syncPFLeadsWithCategories();
