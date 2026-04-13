
import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';

/**
 * HISTORICAL FUNNEL ENGINE (v1.0)
 * AMO EVENTS -> GOOGLE SHEETS (Funnel_History)
 */

const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');
const AMO_TOKENS_FILE = path.join(process.cwd(), 'secrets/amo_tokens.json');
const AMO_DOMAIN = 'reforyou.amocrm.ru';

const PIPELINE_ID = 8696950;

async function syncFunnel() {
    console.log('--- 🛡️ Starting FUNNEL ANALYTICS SYNC ---');
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    const ads = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf8'));

    const auth = new google.auth.GoogleAuth({
        credentials: { client_email: ads.client_email, private_key: ads.private_key },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Fetch Pipelines to map IDs to Names
    const pRes = await fetch(`https://${AMO_DOMAIN}/api/v4/leads/pipelines/${PIPELINE_ID}`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const pData = await pRes.json();
    const statusMap = {};
    pData?._embedded?.statuses?.forEach(s => { statusMap[s.id] = s.name; });
    statusMap[142] = "Квартира оплачена";
    statusMap[143] = "Закрыто и не реализовано";

    // 2. Create Sheet if not exists or clear it
    console.log('Preparing Funnel_History sheet...');
    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [{ addSheet: { properties: { title: 'Funnel_History' } } }]
            }
        });
    } catch (e) {
        console.log('Sheet exists, clearing it...');
        await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: 'Funnel_History!A1:E10000' });
    }

    // Set headers
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Funnel_History!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [['Lead ID', 'From Status', 'To Status', 'Transition Time', 'User ID']] }
    });

    // 3. Fetch Events (Status Changes)
    console.log('Fetching status changed events...');
    let page = 1;
    let allEvents = [];
    const LIMIT = 250;

    // Fetch last 1000 events for history
    while (page <= 4) {
        console.log(`Page ${page}...`);
        const evRes = await fetch(`https://${AMO_DOMAIN}/api/v4/events?filter[type]=lead_status_changed&limit=${LIMIT}&page=${page}`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        
        if (evRes.status === 204) break;
        const data = await evRes.json();
        const events = data?._embedded?.events || [];
        
        events.forEach(ev => {
            const oldSid = ev.value_before[0]?.lead_status?.id;
            const newSid = ev.value_after[0]?.lead_status?.id;
            
            allEvents.push([
                ev.entity_id,
                statusMap[oldSid] || oldSid,
                statusMap[newSid] || newSid,
                new Date(ev.created_at * 1000).toISOString(),
                ev.created_by
            ]);
        });
        page++;
    }

    console.log(`Writing ${allEvents.length} funnel events to Google Sheets...`);
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Funnel_History!A2',
        valueInputOption: 'RAW',
        requestBody: { values: allEvents }
    });

    console.log('--- ✅ FUNNEL SYNC COMPLETE! ---');
}

syncFunnel().catch(console.error);
