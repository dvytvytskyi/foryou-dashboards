import fs from 'fs';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

/**
 * 📊 LEAD AUDIT SYNC V2 (SLA & Rule of 6)
 * Syncs Lead metadata + History-based SLA to BigQuery
 */

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'lead_audit_v2_final';
const PIPELINE_ID = 8696950;
const REFUSAL_REASON_FIELD_ID = 698409;

// AmoCRM Credentials from ENV (via node --env-file)
const AMO_DOMAIN = process.env.AMO_DOMAIN || 'reforyou.amocrm.ru';
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

class AmoClient {
    constructor() {
        this.tokensFile = path.join(process.cwd(), 'secrets/amo_tokens.json');
        this.clientId = process.env.AMO_CLIENT_ID;
        this.clientSecret = process.env.AMO_CLIENT_SECRET;
        this.redirectUri = process.env.AMO_REDIRECT_URI;
    }

    async getAccessToken() {
        const tokens = JSON.parse(fs.readFileSync(this.tokensFile, 'utf8'));
        if (Date.now() > (tokens.expires_at - 60000)) {
            return await this.refreshToken(tokens.refresh_token);
        }
        return tokens.access_token;
    }

    async refreshToken(refreshToken) {
        const res = await fetch(`https://${AMO_DOMAIN}/oauth2/access_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                redirect_uri: this.redirectUri
            })
        });
        const data = await res.json();
        const newTokens = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Date.now() + (data.expires_in * 1000)
        };
        fs.writeFileSync(this.tokensFile, JSON.stringify(newTokens, null, 2));
        return newTokens.access_token;
    }

    async apiRequest(endpoint, options = {}) {
        const token = await this.getAccessToken();
        const res = await fetch(`https://${AMO_DOMAIN}/api/v4/${endpoint}`, {
            ...options,
            headers: { ...options.headers, 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 204) return null;
        if (!res.ok) throw new Error(`API Error ${res.status}: ${await res.text()}`);
        return await res.json();
    }
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function main() {
    console.log('--- 🚀 Starting LEAD AUDIT V2 SYNC ---');
    const client = new AmoClient();

    // 1. Prepare BigQuery Schema
    const schema = [
        { name: 'lead_id', type: 'STRING' },
        { name: 'broker_name', type: 'STRING' },
        { name: 'created_at', type: 'TIMESTAMP' },
        { name: 'first_touch_at', type: 'TIMESTAMP' },
        { name: 'sla_min', type: 'FLOAT' },
        { name: 'first_touch_type', type: 'STRING' },
        { name: 'touch_count', type: 'INTEGER' },
        { name: 'rule_6_pass', type: 'BOOLEAN' },
        { name: 'status_id', type: 'INTEGER' },
        { name: 'refusal_reason', type: 'STRING' },
        { name: 'long_calls_count', type: 'INTEGER' } // Calls > 30s
    ];

    try {
        await bq.dataset(DATASET_ID).table(TABLE_ID).delete();
        console.log('Old table deleted.');
    } catch (e) {}
    
    await bq.dataset(DATASET_ID).createTable(TABLE_ID, { schema });
    console.log('Table created.');

    // 2. Map Users
    const uData = await client.apiRequest('users');
    const usersMap = {};
    uData?._embedded?.users?.forEach(u => usersMap[u.id] = u.name);

    // 3. Fetch ALL Leads with Pagination (Full Sync)
    console.log('--- 🛡️ Starting FULL CRM SYNC (All Records) ---');
    console.log('Fetching leads...');
    let page = 1;
    const leads = [];
    while (true) {
        process.stdout.write(`Fetching page ${page}... `);
        const res = await client.apiRequest(`leads?limit=250&page=${page}&filter[pipeline_id]=${PIPELINE_ID}`);
        if (!res || !res._embedded || !res._embedded.leads || res._embedded.leads.length === 0) {
            console.log('No more pages found.');
            break;
        }
        leads.push(...res._embedded.leads);
        process.stdout.write(`Done (+${res._embedded.leads.length}). Total so far: ${leads.length}\n`);
        page++;
        await sleep(200); // Respect rate limits
    }
    console.log(`Final leads count to analyze: ${leads.length}`);

    const auditData = [];

    for (const lead of leads) {
        process.stdout.write(`Analyzing Lead ${lead.id}... `);
        
        // Fetch events for this specific lead to calculate SLA and touches
        const eventsData = await client.apiRequest(`events?filter[entity]=leads&filter[entity_id]=${lead.id}`);
        const events = eventsData?._embedded?.events || [];
        
        let firstTouchAt = null;
        let firstTouchType = null;
        let touchCount = 0;
        let longCallsCount = 0;

        // Filter and Sort events by time
        const auditTypes = ['outgoing_call', 'outgoing_chat_message', 'message_sent', 'phone_call'];
        const allTypes = events.map(e => e.type);
        if (allTypes.length > 0) process.stdout.write(`Types: ${[...new Set(allTypes)].join(',')} `);
        
        const sortedEvents = events
            .filter(ev => auditTypes.includes(ev.type))
            .sort((a,b) => a.created_at - b.created_at);

        sortedEvents.forEach(ev => {
            touchCount++;
            if (!firstTouchAt) {
                firstTouchAt = new Date(ev.created_at * 1000).toISOString();
                firstTouchType = ev.type.includes('call') ? 'Call' : 'WhatsApp/Chat';
            }
            
            // Check call duration if it's a call event
            if (ev.type.includes('call')) {
                const duration = ev.value_after[0]?.phone_call?.duration || ev.value_after[0]?.outgoing_call?.duration || 0;
                if (duration > 30) longCallsCount++;
            }
        });

        const slaMin = firstTouchAt ? (new Date(firstTouchAt).getTime() - (lead.created_at * 1000)) / 60000 : null;

        // Get Refusal Reason from custom fields
        let refusalReason = null;
        const refusalField = lead.custom_fields_values?.find(f => f.field_id === REFUSAL_REASON_FIELD_ID);
        if (refusalField) {
            refusalReason = refusalField.values[0].value;
        }

        auditData.push({
            lead_id: lead.id.toString(),
            broker_name: usersMap[lead.responsible_user_id] || 'N/A',
            created_at: new Date(lead.created_at * 1000).toISOString(),
            first_touch_at: firstTouchAt,
            sla_min: slaMin ? parseFloat(slaMin.toFixed(2)) : null,
            first_touch_type: firstTouchType,
            touch_count: touchCount,
            rule_6_pass: touchCount >= 6,
            status_id: lead.status_id,
            refusal_reason: refusalReason,
            long_calls_count: longCallsCount
        });

        process.stdout.write(`Done (SLA: ${slaMin ? slaMin.toFixed(0) + 'm' : 'N/A'})\n`);
        await sleep(100); // Rate limit
    }

    console.log(`Uploading ${auditData.length} records to BigQuery...`);
    await bq.dataset(DATASET_ID).table(TABLE_ID).insert(auditData);
    console.log('--- ✅ SYNC COMPLETE ---');
}

main().catch(console.error);
