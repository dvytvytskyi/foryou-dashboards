import fs from 'fs';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const domain = 'reforyou.amocrm.ru';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE
});

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function fullSync() {
    console.log('--- STARTING GLOBAL AMO SYNC (HISTORICAL) ---');
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    const datasetId = 'foryou_analytics';
    const leadsTableId = 'leads_all_history_full';
    const eventsTableId = 'events_all_history_full';

    // 1. Fetch Users (for mapping)
    const usersRes = await fetch(`https://${domain}/api/v4/users`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const usersData = await usersRes.json();
    const usersMap = {};
    usersData._embedded?.users?.forEach(u => usersMap[u.id] = u.name);

    // 2. FETCH ALL LEADS (Pagination until the end)
    let totalLeads = [];
    let nextLeadsUrl = `https://${domain}/api/v4/leads?limit=250`;
    
    console.log('Step 1: Fetching ALL LEADS...');
    while (nextLeadsUrl) {
        const res = await fetch(nextLeadsUrl, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        if (res.status === 429) { await sleep(1000); continue; }
        const data = await res.json();
        const pageLeads = data._embedded?.leads || [];
        totalLeads = totalLeads.concat(pageLeads.map(l => ({
            lead_id: l.id,
            name: l.name || 'No Name',
            status_id: l.status_id,
            responsible_user: usersMap[l.responsible_user_id] || 'Unknown',
            price: l.price || 0,
            created_at: new Date(l.created_at * 1000).toISOString(),
            closed_at: l.closed_at ? new Date(l.closed_at * 1000).toISOString() : null
        })));
        
        console.log(`Leads Progress: ${totalLeads.length}...`);
        nextLeadsUrl = data._links?.next?.href;
        if (!nextLeadsUrl) break;
        await sleep(200); // Rate limit protection
    }

    // Save Leads to BQ using Load Job (Much more reliable)
    const leadsSchema = {
        fields: [
            { name: 'lead_id', type: 'INT64' },
            { name: 'name', type: 'STRING' },
            { name: 'status_id', type: 'INT64' },
            { name: 'responsible_user', type: 'STRING' },
            { name: 'price', type: 'FLOAT64' },
            { name: 'created_at', type: 'TIMESTAMP' },
            { name: 'closed_at', type: 'TIMESTAMP' }
        ]
    };
    
    console.log(`Starting Batch Load for ${totalLeads.length} leads...`);
    const leadsJson = totalLeads.map(l => JSON.stringify(l)).join('\n');
    const leadsFile = path.resolve('/tmp/leads_temp.json');
    fs.writeFileSync(leadsFile, leadsJson);

    const [job] = await bq.dataset(datasetId).table(leadsTableId).load(leadsFile, {
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        writeDisposition: 'WRITE_TRUNCATE',
        schema: leadsSchema
    });
    const jobId = job.id.split('.').pop();
    console.log(`Job ${jobId} started. Polling for completion...`);
    
    while (true) {
        const [metadata] = await bq.job(jobId).getMetadata();
        if (metadata.status.state === 'DONE') break;
        process.stdout.write('.');
        await sleep(3000);
    }
    console.log(`\nSUCCESS: ${totalLeads.length} Leads saved via Load Job.`);

    // 3. FETCH ALL EVENTS (Deep Historical Scan)
    let totalEvents = [];
    let nextEventsUrl = `https://${domain}/api/v4/events?limit=250`;
    
    console.log('Step 2: Fetching ALL EVENTS (Deep Scan)...');
    for (let page = 0; page < 2000; page++) { // Up to 500k events
        const res = await fetch(nextEventsUrl, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        if (res.status === 429) { await sleep(2000); page--; continue; }
        const data = await res.json();
        const pageEvents = data._embedded?.events || [];
        if (pageEvents.length === 0) break;
        
        totalEvents = totalEvents.concat(pageEvents.map(e => ({
            event_id: e.id,
            entity_id: e.entity_id,
            event_type: e.type,
            created_at: new Date(e.created_at * 1000).toISOString(),
            user_name: usersMap[e.created_by] || 'System'
        })));

        if (page % 50 === 0) console.log(`Events Progress: ${totalEvents.length}...`);
        nextEventsUrl = data._links?.next?.href;
        if (!nextEventsUrl) break;
        await sleep(150);
    }

    // Save Events to BQ using Load Job
    const eventsSchema = {
        fields: [
            { name: 'event_id', type: 'STRING' },
            { name: 'entity_id', type: 'INT64' },
            { name: 'event_type', type: 'STRING' },
            { name: 'created_at', type: 'TIMESTAMP' },
            { name: 'user_name', type: 'STRING' }
        ]
    };

    console.log(`Starting Batch Load for ${totalEvents.length} events...`);
    const eventsJson = totalEvents.map(e => JSON.stringify(e)).join('\n');
    const eventsFile = path.resolve('/tmp/events_temp.json');
    fs.writeFileSync(eventsFile, eventsJson);

    const [eventJob] = await bq.dataset(datasetId).table(eventsTableId).load(eventsFile, {
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        writeDisposition: 'WRITE_TRUNCATE',
        schema: eventsSchema
    });
    const eventJobId = eventJob.id.split('.').pop();
    console.log(`Job ${eventJobId} started. Polling for completion...`);
    
    while (true) {
        const [eMetadata] = await bq.job(eventJobId).getMetadata();
        if (eMetadata.status.state === 'DONE') break;
        process.stdout.write('.');
        await sleep(3000);
    }
    console.log(`\nSUCCESS: ${totalEvents.length} Events saved via Load Job.`);
}

fullSync().catch(console.error);
