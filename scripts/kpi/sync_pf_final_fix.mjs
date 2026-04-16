import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE,
    location: 'europe-central2' // WARSAW REGION
});

const PF_API_KEY = process.env.PF_API_KEY || ''; 
const PF_API_SECRET = process.env.PF_API_SECRET || ''; 

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
    while (page <= 20) {
        process.stdout.write(`Fetching listings data... page ${page}\r`);
        const res = await fetch(`https://atlas.propertyfinder.com/v1/listings?perPage=100&page=${page}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (!res.ok) break;
        const data = await res.json();
        const listings = data.data || [];
        if (listings.length === 0) break;
        
        listings.forEach(l => {
            const isRent = ['perYear', 'perMonth', 'perWeek', 'perDay'].includes(l.price?.type);
            allListings[l.id] = isRent ? 'Rent' : 'Sale';
        });
        page++;
    }
    console.log('\nListings data loaded.');
    return allListings;
}

async function syncPFLeadsFinal() {
    console.log('--- REANIMATING PF LEADS TABLE ---');
    try {
        const token = await getPFToken();
        const listingMap = await fetchAllListings(token);
        
        // Fetch Leads
        let allLeads = [];
        for (let page = 1; page <= 50; page++) {
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
            const listingRef = l.listing?.reference || '';
            const pfType = listingMap[listingId] || 'Unknown'; 

            return {
                id: String(l.id),
                type: l.channel || l.type,
                source: l.source || 'Property Finder',
                status: l.status,
                customer_name: l.sender?.name || null,
                customer_phone: phoneObj?.value || null,
                listing_id: String(listingId || ''),
                listing_ref: String(listingRef),
                pf_category: pfType,
                created_at: l.createdAt,
                updated_at: new Date().toISOString()
            };
        });

        const tableId = 'pf_leads_raw';
        const dataset = bq.dataset(DATASET_ID);
        const table = dataset.table(tableId);

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

        // Recreate table if needed
        const [exists] = await table.exists();
        if (!exists) {
            await dataset.createTable(tableId, { schema, location: 'europe-central2' });
            console.log('Table recreated.');
        }

        const resultsJson = bqRows.map(r => JSON.stringify(r)).join('\n');
        const tempFile = path.resolve('./tmp_pf_leads_reborn.json');
        const fs = await import('fs');
        fs.writeFileSync(tempFile, resultsJson);

        await table.load(tempFile, {
            sourceFormat: 'NEWLINE_DELIMITED_JSON',
            writeDisposition: 'WRITE_TRUNCATE',
            schema: schema
        });

        console.log(`SUCCESS: ${bqRows.length} leads synced and table fixed.`);
    } catch (e) {
        console.error('CRITICAL ERROR:', e);
    }
}

syncPFLeadsFinal();
