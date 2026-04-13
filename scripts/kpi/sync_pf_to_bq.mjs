import fs from 'fs';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

// Credentials provided by user
const PF_API_KEY = 'OJIlJ.2x35n9PkjxHYTwuN5xI3UsqLxXqUR9c44R';
const PF_API_SECRET = '1mAsFUrBgd0aPFHc6BvGja25DbKe1Bb5';
const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE
});

async function getPFToken() {
    console.log('Fetching Property Finder Access Token...');
    const res = await fetch('https://atlas.propertyfinder.com/v1/auth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            apiKey: PF_API_KEY,
            apiSecret: PF_API_SECRET
        })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Auth failed: ${res.status} ${err}`);
    }

    const data = await res.json();
    console.log('Token obtained. Expires in:', data.expiresIn);
    return data.accessToken;
}

async function syncPFLeads() {
    console.log('--- SYNCING ALL PROPERTY FINDER LEADS (LISTINGS + PROJECTS) ---');
    
    try {
        const token = await getPFToken();
        let allLeads = [];
        let maxPages = 20;

        // 1. Fetch Regular Listing Leads
        console.log('Fetching regular listing leads...');
        for (let page = 1; page <= maxPages; page++) {
            const url = `https://atlas.propertyfinder.com/v1/leads?perPage=50&page=${page}&entityType=listing`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            if (!res.ok) break;
            const data = await res.json();
            const leads = data.data || [];
            if (leads.length === 0) break;
            allLeads.push(...leads.map(l => ({ ...l, pf_category: 'Sale' }))); // Default many to Sale
            if (page > 10) break; 
        }

        // 2. Fetch Project Leads
        console.log('Fetching project (Primary Plus) leads...');
        for (let page = 1; page <= maxPages; page++) {
            const url = `https://atlas.propertyfinder.com/v1/leads?perPage=50&page=${page}&entityType=project`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            if (!res.ok) break;
            const data = await res.json();
            const leads = data.data || [];
            if (leads.length === 0) break;
            allLeads.push(...leads.map(l => ({ ...l, pf_category: 'project' })));
            if (page > 10) break;
        }

        console.log(`Successfully fetched ${allLeads.length} leads in total.`);
        if (allLeads.length === 0) return;

        // Save to BigQuery
        const datasetId = 'foryou_analytics';
        const tableId = 'pf_leads_raw';
        const dataset = bq.dataset(datasetId);
        const table = dataset.table(tableId);

        const bqRows = allLeads.map(l => {
            const phoneObj = l.sender?.contacts?.find(c => c.type === 'phone');
            const emailObj = l.sender?.contacts?.find(c => c.type === 'email');
            
            return {
                id: String(l.id),
                type: l.channel || l.type,
                source: l.source || 'Property Finder',
                status: l.status,
                customer_name: l.sender?.name || null,
                customer_phone: phoneObj?.value || null,
                customer_email: emailObj?.value || null,
                listing_id: String(l.listing?.id || l.project?.id || ''),
                listing_ref: String(l.listing?.reference || l.project?.reference || l.project?.id || ''),
                pf_category: l.pf_category || 'Sale',
                created_at: l.createdAt,
                updated_at: new Date().toISOString()
            };
        });

        const resultsJson = bqRows.map(r => JSON.stringify(r)).join('\n');
        const tempFile = path.resolve('/tmp/pf_leads_combined.json');
        fs.writeFileSync(tempFile, resultsJson);

        await table.load(tempFile, {
            sourceFormat: 'NEWLINE_DELIMITED_JSON',
            writeDisposition: 'WRITE_TRUNCATE',
            schema: {
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
            }
        });

        console.log('SUCCESS: All Property Finder leads synced to BigQuery (pf_leads_raw).');

    } catch (e) {
        console.error('ERROR during PF sync:', e.message);
    }
}

syncPFLeads().catch(console.error);
