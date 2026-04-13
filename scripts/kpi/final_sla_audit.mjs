import fs from 'fs';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const domain = 'reforyou.amocrm.ru';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function syncSLA() {
    console.log('--- CALCULATING SMART SLA (8AM SHIFT) ---');
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    // 1. Fetch Lead Addition and Status Change Events
    const startTime = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000);
    const url = `https://${domain}/api/v4/events?filter[created_at][from]=${startTime}`;
    
    console.log('Fetching events for SLA...');
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const data = await res.json();
    const events = data._embedded?.events || [];

    // 2. Fetch Users mapping
    const usersRes = await fetch(`https://${domain}/api/v4/users`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const usersData = await usersRes.json();
    const usersMap = {};
    usersData._embedded?.users?.forEach(u => usersMap[u.id] = u.name);

    // 3. Process Logic: Group by Lead ID
    const leadEvents = {};
    events.forEach(e => {
        if (!leadEvents[e.entity_id]) leadEvents[e.entity_id] = { created_at: null, responded_at: null, broker: null };
        
        if (e.type === 'lead_added') {
            leadEvents[e.entity_id].created_at = e.created_at;
        }
        
        if (e.type === 'lead_status_changed' && !leadEvents[e.entity_id].responded_at) {
            leadEvents[e.entity_id].responded_at = e.created_at;
            leadEvents[e.entity_id].broker = usersMap[e.created_by] || 'Unknown';
        }
    });

    // 4. Calculate Smart SLA
    const slaRows = Object.keys(leadEvents).map(id => {
        const item = leadEvents[id];
        if (!item.created_at || !item.responded_at || !item.broker) return null;

        const originalCreated = new Date(item.created_at * 1000);
        let effectiveCreated = new Date(item.created_at * 1000);
        const hour = originalCreated.getHours();

        // SHIFT LOGIC: 21:00 - 08:00
        if (hour >= 21 || hour < 8) {
            if (hour >= 21) {
                effectiveCreated.setDate(effectiveCreated.getDate() + 1);
            }
            effectiveCreated.setHours(8, 0, 0, 0);
        }

        const responded = new Date(item.responded_at * 1000);
        // Minutes diff
        const diffMin = Math.max(0, Math.floor((responded - effectiveCreated) / (1000 * 60)));

        return {
            lead_id: id,
            broker_name: item.broker,
            original_time: originalCreated.toISOString(),
            effective_time: effectiveCreated.toISOString(),
            response_time: responded.toISOString(),
            sla_minutes: diffMin
        };
    }).filter(Boolean);

    console.log(`Calculated SLA for ${slaRows.length} leads.`);

    const valuesStr = slaRows.map(r => 
        `(${r.lead_id}, TIMESTAMP '${r.original_time}', TIMESTAMP '${r.effective_time}', TIMESTAMP '${r.response_time}', ${r.sla_minutes}, '${r.broker_name.replace(/'/g, "\\'")}')`
    ).join(',\n');

    const query = `
        CREATE OR REPLACE TABLE \`crypto-world-epta.foryou_analytics.lead_sla_audit\` AS
        SELECT * FROM UNNEST([
            STRUCT<lead_id INT64, original_time TIMESTAMP, effective_time TIMESTAMP, response_time TIMESTAMP, sla_min INT64, broker_name STRING>
            ${valuesStr}
        ])
    `;

    await bq.query(query);
    console.log('SUCCESS: SLA Audit synced.');
}

syncSLA().catch(console.error);
