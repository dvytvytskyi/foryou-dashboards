
import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';

/**
 * MILESTONE FUNNEL ENGINE (v5.0) - THE 10/10 VERSION
 * PIVOT: Lead ID -> [Qualified Date, Meeting Date, Reservation Date, Closed Date]
 */

const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');
const AMO_TOKENS_FILE = path.join(process.cwd(), 'secrets/amo_tokens.json');
const AMO_DOMAIN = 'reforyou.amocrm.ru';

const MILESTONE_STAGES = {
    QUALIFIED: 70457466,   // квалификация пройдена
    MEETING: 70457474,     // презентация проведена
    RESERVATION: 70457482, // EOI / чек получен
    CLOSED: 142            // квартира оплачена
};

async function syncMilestones() {
    console.log('--- 🛡️ Starting MILESTONE FUNNEL SYNC ---');
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    const ads = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf8'));

    const auth = new google.auth.GoogleAuth({
        credentials: { client_email: ads.client_email, private_key: ads.private_key },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Clear or Create the Sheet
    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: { requests: [{ addSheet: { properties: { title: 'Funnel_Milestones' } } }] }
        });
    } catch (e) {
        await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: 'Funnel_Milestones!A1:E5000' });
    }

    // Set headers
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: 'Funnel_Milestones!A1',
        valueInputOption: 'RAW', requestBody: { values: [['Deal_ID', 'Date_Qualified', 'Date_Meeting', 'Date_Reservation', 'Date_Closed']] }
    });

    // 2. Fetch Events (Bulk scanning for history)
    console.log('Fetching status history events...');
    const milestonesData = {}; // LeadID -> { QUALIFIED, MEETING, RESERVATION, CLOSED }

    let page = 1;
    while (page <= 20) { // Scan back to find milestones for ~5000 events
        const res = await fetch(`https://${AMO_DOMAIN}/api/v4/events?filter[type]=lead_status_changed&limit=250&page=${page}`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        if (res.status === 204) break;
        const data = await res.json();
        const events = data?._embedded?.events || [];
        
        events.forEach(ev => {
            const newSid = ev.value_after[0]?.lead_status?.id;
            const entry = milestonesData[ev.entity_id] || {};
            
            const dateStr = new Date(ev.created_at * 1000).toISOString().split('T')[0]; // YYYY-MM-DD

            // Keep only the EARLIEST date if multiple transitions occurred
            if (newSid === MILESTONE_STAGES.QUALIFIED && (!entry.QUALIFIED || entry.QUALIFIED > dateStr)) entry.QUALIFIED = dateStr;
            if (newSid === MILESTONE_STAGES.MEETING && (!entry.MEETING || entry.MEETING > dateStr)) entry.MEETING = dateStr;
            if (newSid === MILESTONE_STAGES.RESERVATION && (!entry.RESERVATION || entry.RESERVATION > dateStr)) entry.RESERVATION = dateStr;
            if (newSid === MILESTONE_STAGES.CLOSED && (!entry.CLOSED || entry.CLOSED > dateStr)) entry.CLOSED = dateStr;
            
            milestonesData[ev.entity_id] = entry;
        });
        page++;
    }

    const finalRows = Object.entries(milestonesData).map(([id, dates]) => [
        id, dates.QUALIFIED || '', dates.MEETING || '', dates.RESERVATION || '', dates.CLOSED || ''
    ]);

    console.log(`Writing ${finalRows.length} deal milestones...`);
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: 'Funnel_Milestones!A2',
        valueInputOption: 'RAW', requestBody: { values: finalRows }
    });

    console.log('--- ✅ HISTORICAL MILSTONE FUNNEL COMPLETE! ---');
}

syncMilestones().catch(console.error);
