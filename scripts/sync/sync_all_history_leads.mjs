import fs from 'fs';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

/**
 * 🚀 GLOBAL LEADS HISTORY SYNC (AmoCRM -> BigQuery)
 * Refreshes tokens automatically and scans ALL leads.
 */

// --- CONFIG ---
const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'leads_all_history';
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');
const TOKENS_FILE = path.join(process.cwd(), 'secrets/amo_tokens.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

class AmoClient {
    constructor() {
        this.domain = 'reforyou.amocrm.ru';
        // Credentials hardcoded for standalone script reliability
        this.clientId = '2912780f-a1e4-4d5d-a069-ee01422d8bef'; 
        this.clientSecret = 'PW0FFyI4WRLzGgKeD7ZTdTFykSMhMNPkCk1WJ6fBzdvmjvc2RQEt1eO6t88fPBhH';
    }

    async getAccessToken() {
        const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
        if (Date.now() > (tokens.expires_at - 60000)) {
            return await this.refreshToken(tokens.refresh_token);
        }
        return tokens.access_token;
    }

    async refreshToken(refreshToken) {
        console.log('Refreshing amoCRM tokens...');
        const res = await fetch(`https://${this.domain}/oauth2/access_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                redirect_uri: 'https://admin.foryou-realestate.com/api/amo-crm/callback'
            })
        });
        const data = await res.json();
        if (data.error) throw new Error(`Token Refresh Failed: ${JSON.stringify(data)}`);
        
        const newTokens = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Date.now() + (data.expires_in * 1000)
        };
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(newTokens, null, 2));
        return newTokens.access_token;
    }

    async apiRequest(endpoint, options = {}) {
        const token = await this.getAccessToken();
        const res = await fetch(`https://${this.domain}/api/v4/${endpoint}`, {
            ...options,
            headers: { ...options.headers, 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 204) return null;
        if (!res.ok) throw new Error(`API Error ${res.status}: ${await res.text()}`);
        return await res.json();
    }
}

async function syncAllLeads() {
    console.log('--- 🛡️ Starting GLOBAL LEADS HISTORY SCAN ---');
    const client = new AmoClient();
    
    // 1. Prepare Table Schema
    const schema = [
        { name: 'id', type: 'STRING' },
        { name: 'name', type: 'STRING' },
        { name: 'status_id', type: 'INTEGER' },
        { name: 'pipeline_id', type: 'INTEGER' },
        { name: 'price', type: 'FLOAT' },
        { name: 'created_at', type: 'TIMESTAMP' },
        { name: 'closed_at', type: 'TIMESTAMP' },
        { name: 'updated_at', type: 'TIMESTAMP' }
    ];

    try {
        console.log(`Resetting table ${TABLE_ID}...`);
        const table = bq.dataset(DATASET_ID).table(TABLE_ID);
        const [exists] = await table.exists();
        if (exists) await table.delete();
    } catch (e) {
        console.log('Notice during table reset:', e.message);
    }

    await bq.dataset(DATASET_ID).createTable(TABLE_ID, { schema });
    console.log(`Table ${TABLE_ID} ready in BigQuery.`);

    let page = 1;
    let allLeadsCount = 0;
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    while (true) {
        try {
            process.stdout.write(`Fetching page ${page}... `);
            const data = await client.apiRequest(`leads?limit=250&page=${page}`);
            
            if (!data || !data._embedded || !data._embedded.leads || data._embedded.leads.length === 0) {
                console.log('No more leads found.');
                break;
            }

            const pageLeads = data._embedded.leads.map(l => ({
                id: l.id.toString(),
                name: l.name || '',
                status_id: l.status_id,
                pipeline_id: l.pipeline_id,
                price: parseFloat(l.price || 0),
                created_at: new Date(l.created_at * 1000).toISOString(),
                closed_at: l.closed_at ? new Date(l.closed_at * 1000).toISOString() : null,
                updated_at: new Date(l.updated_at * 1000).toISOString()
            }));

            // Upload directly to BQ per page to save memory
            await bq.dataset(DATASET_ID).table(TABLE_ID).insert(pageLeads);
            
            allLeadsCount += pageLeads.length;
            console.log(`Uploaded ${pageLeads.length}. Subtotal: ${allLeadsCount}`);
            
            page++;
            await sleep(200); 
        } catch (e) {
            console.error('Error processing page:', page, e.message);
            break;
        }
    }
    console.log(`--- ✅ SYNC COMPLETE: ${allLeadsCount} leads processed ---`);
}

syncAllLeads().catch(console.error);
