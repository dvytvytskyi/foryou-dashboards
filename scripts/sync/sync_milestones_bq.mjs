import fs from 'fs';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

/**
 * MILESTONE SYNC TO BIGQUERY (v7.0)
 * Scans ALL AmoCRM events and uploads unique milestones to BigQuery
 */

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'milestones';
const AMO_DOMAIN = 'reforyou.amocrm.ru';
const AMO_TOKENS_FILE = path.join(process.cwd(), 'secrets/amo_tokens.json');
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');

const MILESTONE_STAGES = {
    QUALIFIED: 70457466,   // квалификация пройдена
    MEETING: 70457474,     // презентация проведена
    RESERVATION: 70457482, // EOI / чек получен
    WON: 142               // успешно реализовано
};

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function syncToBigQuery() {
    console.log('--- 🛡️ Starting DEEP SCAN to BIGQUERY ---');
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    
    // 1. Prepare Table Schema
    const schema = [
        { name: 'deal_id', type: 'STRING' },
        { name: 'date_qual', type: 'DATE' },
        { name: 'date_meet', type: 'DATE' },
        { name: 'date_res', type: 'DATE' },
        { name: 'date_won', type: 'DATE' }
    ];

    // Create or clear the table
    try {
        await bq.dataset(DATASET_ID).createTable(TABLE_ID, { schema });
        console.log(`Created table ${TABLE_ID}`);
    } catch (e) {
        console.log(`Table ${TABLE_ID} exists. Overwriting...`);
    }

    // 2. Fetch Events from AmoCRM
    const milestones = {}; // lead_id -> { QUALIFIED, MEETING, RESERVATION, WON }
    
    let page = 1;
    let totalEvents = 0;
    
    console.log('Scanning events API (250 items per page)...');
    
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    while (page <= 2000) { // Safety limit of 2000 pages (~500k events)
        let success = false;
        let attempt = 0;
        
        while (!success && attempt < 3) {
            try {
                const url = `https://${AMO_DOMAIN}/api/v4/events?filter[type]=lead_status_changed&limit=250&page=${page}`;
                const res = await fetch(url, { headers: { 'Authorization': `Bearer ${tokens.access_token}` } });
                
                if (res.status === 204) { success = true; page = 9999; break; }
                if (!res.ok) { throw new Error(`API Error ${res.status}`); }
                
                const data = await res.json();
                const events = data?._embedded?.events || [];
                if (events.length === 0) { success = true; page = 9999; break; }

                events.forEach(ev => {
                    const sid = ev.value_after[0]?.lead_status?.id;
                    const lid = ev.entity_id;
                    const date = new Date(ev.created_at * 1000).toISOString().split('T')[0];
                    if (!milestones[lid]) milestones[lid] = {};
                    const m = milestones[lid];
                    if (sid === MILESTONE_STAGES.QUALIFIED && (!m.qual || m.qual > date)) m.qual = date;
                    if (sid === MILESTONE_STAGES.MEETING && (!m.meet || m.meet > date)) m.meet = date;
                    if (sid === MILESTONE_STAGES.RESERVATION && (!m.res || m.res > date)) m.res = date;
                    if (sid === MILESTONE_STAGES.WON && (!m.won || m.won > date)) m.won = date;
                });

                totalEvents += events.length;
                if (page % 5 === 0) console.log(`Processed ${totalEvents} events...`);
                success = true;
                await sleep(500); // 0.5s pause to avoid rate limits
            } catch (e) {
                attempt++;
                console.warn(`Retry ${attempt} for page ${page}...`);
                await sleep(2000);
            }
        }
        if (!success) break;
        if (page >= 9999) break;
        page++;
    }

    // 3. Prepare result rows
    const rows = Object.entries(milestones).map(([id, d]) => ({
        deal_id: id.toString(),
        date_qual: d.qual || null,
        date_meet: d.meet || null,
        date_res: d.res || null,
        date_won: d.won || null
    })).filter(r => r.date_qual || r.date_meet || r.date_res || r.date_won);

    console.log(`Extracted ${rows.length} lead milestones. Inserting to BigQuery...`);

    // Split into chunks if needed (BQ limit is ~10k per request usually)
    const dataset = bq.dataset(DATASET_ID);
    const table = dataset.table(TABLE_ID);

    try {
        // Delete old data for full replacement logic
        await bq.query(`DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\` WHERE 1=1`);
        
        await table.insert(rows);
        console.log(`--- ✅ BIGQUERY LOAD COMPLETE: ${rows.length} rows ---`);
    } catch (e) {
        if (e.name === 'PartialFailureError') {
            console.error('Insert Errors:', JSON.stringify(e.errors, null, 2));
        } else {
            console.error('BigQuery Error:', e);
        }
    }
}

syncToBigQuery().catch(console.error);
