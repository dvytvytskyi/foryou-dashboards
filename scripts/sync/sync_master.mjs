
import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';

/**
 * MASTER SYNC ENGINE (v4.0)
 * 1. Touches KPI
 * 2. Funnel History
 * 3. Auto-Deployment Ready
 */

const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');
const AMO_TOKENS_FILE = path.join(process.cwd(), 'secrets/amo_tokens.json');
const AMO_DOMAIN = 'reforyou.amocrm.ru';
const PIPELINE_ID = 8696950;

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function masterSync() {
    console.log('--- 🚀 MASTER SYNC STARTED ---');
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    const ads = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf8'));

    // Authenticate Google
    const auth = new google.auth.GoogleAuth({
        credentials: { client_email: ads.client_email, private_key: ads.private_key },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // --- SECTION 1: USERS & STATUSES ---
    const [uRes, pRes] = await Promise.all([
        fetch(`https://${AMO_DOMAIN}/api/v4/users`, { headers: { 'Authorization': `Bearer ${tokens.access_token}` } }),
        fetch(`https://${AMO_DOMAIN}/api/v4/leads/pipelines/${PIPELINE_ID}`, { headers: { 'Authorization': `Bearer ${tokens.access_token}` } })
    ]);
    const uData = await uRes.json();
    const pData = await pRes.json();
    
    const usersMap = {};
    uData?._embedded?.users?.forEach(u => { usersMap[u.id] = u.name; });
    
    const statusMap = {};
    pData?._embedded?.statuses?.forEach(s => { statusMap[s.id] = s.name; });
    statusMap[142] = "Квартира оплачена";
    statusMap[143] = "Закрыто и не реализовано";


    // --- SECTION 2: TOUCHES SYNC (Recent 100) ---
    console.log('Updating Touches Log...');
    const leadsRes = await fetch(`https://${AMO_DOMAIN}/api/v4/leads?limit=100&filter[pipeline_id]=${PIPELINE_ID}`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const leadsData = await leadsRes.json();
    const leads = leadsData?._embedded?.leads || [];
    
    const touchRows = [];
    for (const lead of leads) {
        process.stdout.write(`L-${lead.id} `);
        const tRes = await fetch(`https://${AMO_DOMAIN}/api/v4/tasks?filter[entity_id]=${lead.id}&filter[is_completed]=1`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        let cTasks = [];
        if (tRes.status === 200) {
            const data = await tRes.json();
            cTasks = (data?._embedded?.tasks || []).filter(t => t.task_type_id === 1);
        }
        const total = cTasks.length;
        let rt = 0;
        if (total > 0) {
            const first = cTasks.sort((a,b) => a.updated_at - b.updated_at)[0];
            rt = Math.round((first.updated_at - lead.created_at) / 60);
        }
        touchRows.push([ lead.id, usersMap[lead.responsible_user_id] || "System", total, rt ]);
        await sleep(50);
    }
    
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: 'Touches_Log!A2',
        valueInputOption: 'RAW', requestBody: { values: touchRows }
    });


    // --- SECTION 3: FUNNEL EVENTS (Last 250) ---
    console.log('\nUpdating Funnel History...');
    const evRes = await fetch(`https://${AMO_DOMAIN}/api/v4/events?filter[type]=lead_status_changed&limit=250`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    if (evRes.status === 200) {
        const data = await evRes.json();
        const evRows = (data?._embedded?.events || []).map(ev => [
            ev.entity_id,
            statusMap[ev.value_before[0]?.lead_status?.id] || "Unknown",
            statusMap[ev.value_after[0]?.lead_status?.id] || "Unknown",
            new Date(ev.created_at * 1000).toISOString(),
            usersMap[ev.created_by] || ev.created_by
        ]);
        
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID, range: 'Funnel_History!A2',
            valueInputOption: 'RAW', requestBody: { values: evRows }
        });
    }

    console.log('\n--- ✅ MASTER SYNC COMPLETE! ---');
}

masterSync().catch(console.error);
