import 'dotenv/config';
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
const PF_API_URL = 'https://atlas.propertyfinder.com/v1';

const LISTING_FILTERS = [
    { category: 'residential', offeringType: 'sale', label: 'Sell' },
    { category: 'residential', offeringType: 'rent', label: 'Rent' },
    { category: 'commercial', offeringType: 'sale', label: 'Commercial Sell' },
    { category: 'commercial', offeringType: 'rent', label: 'Commercial Rent' }
];

const LISTING_STATES = ['live', 'archived', 'unpublished', 'takendown'];

async function getPFToken() {
    if (!PF_API_KEY || !PF_API_SECRET) {
        throw new Error('Missing PF_API_KEY or PF_API_SECRET');
    }

    const res = await fetch(`${PF_API_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: PF_API_KEY, apiSecret: PF_API_SECRET })
    });
    const data = await res.json();
    if (!res.ok || !data?.accessToken) {
        throw new Error(`PF token error: ${JSON.stringify(data)}`);
    }
    return data.accessToken;
}

async function fetchListingsByFilter(token, category, offeringType, state) {
    let page = 1;
    const out = [];

    while (true) {
        process.stdout.write(`Fetching listings ${category}/${offeringType}/${state} page ${page}      \r`);
        const url = `${PF_API_URL}/listings?filter[category]=${category}&filter[offeringType]=${offeringType}&filter[state]=${state}&perPage=50&page=${page}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
        });

        if (!res.ok) {
            const err = await res.text();
            console.warn(`Listings fetch failed for ${category}/${offeringType}/${state}: ${err}`);
            break;
        }

        const data = await res.json();
        const listings = data.results || data.data || [];
        if (!listings.length) break;

        out.push(...listings);
        if (!data.pagination?.nextPage) break;
        page = data.pagination.nextPage;
    }

    return out;
}

async function fetchAllListings(token) {
    const listingTypeById = {};

    for (const f of LISTING_FILTERS) {
        for (const state of LISTING_STATES) {
            const listings = await fetchListingsByFilter(token, f.category, f.offeringType, state);
            for (const l of listings) {
                if (!l?.id) continue;
                listingTypeById[String(l.id)] = f.label;
            }
        }
    }

    console.log(`\nListings data loaded. keys=${Object.keys(listingTypeById).length}`);
    return listingTypeById;
}

async function syncPFLeadsFinal() {
    console.log('--- REANIMATING PF LEADS TABLE ---');
    try {
        const token = await getPFToken();
        const listingMap = await fetchAllListings(token);
        
        // Fetch all leads without a hard page limit.
        let allLeads = [];
        let page = 1;
        while (true) {
            if (page % 10 === 0) {
                process.stdout.write(`Fetching leads page ${page} (loaded ${allLeads.length})      \r`);
            }
            const res = await fetch(`${PF_API_URL}/leads?perPage=50&page=${page}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            if (!res.ok) break;
            const data = await res.json();
            const leads = data.data || data.results || [];
            if (leads.length === 0) break;
            allLeads.push(...leads);
            if (!data.pagination?.nextPage) break;
            page = data.pagination.nextPage;
        }
        console.log(`\nFetched leads total: ${allLeads.length}`);

        const bqRows = allLeads.map(l => {
            const phoneObj = l.sender?.contacts?.find(c => c.type === 'phone');
            const listingId = l.listing?.id;
            const listingRef = l.listing?.reference || '';
            const normalizedListingId = listingId ? String(listingId) : null;
            const isProjectLead = String(l.entityType || '').toLowerCase() === 'project';
            const pfType = isProjectLead ? 'project' : (normalizedListingId ? (listingMap[normalizedListingId] || 'Unknown') : 'Unknown'); 

            return {
                id: String(l.id),
                type: l.channel || l.type,
                source: l.source || 'Property Finder',
                status: l.status,
                customer_name: l.sender?.name || null,
                customer_phone: phoneObj?.value || null,
                customer_email: null,
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
