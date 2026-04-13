
import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';

/**
 * AUTO-EXPANDING SYNC ENGINE (v3.0)
 * AMO CRM (Tasks) -> GOOGLE SHEETS (Infinite Rows)
 */

const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');
const AMO_TOKENS_FILE = path.join(process.cwd(), 'secrets/amo_tokens.json');
const AMO_DOMAIN = 'reforyou.amocrm.ru';

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function totalSync() {
    console.log('--- 🛡️ Starting TOTAL REPLICATION ---');
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    const ads = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf8'));

    // Authenticate with Google
    const auth = new google.auth.GoogleAuth({
        credentials: { client_email: ads.client_email, private_key: ads.private_key },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. AUTO-EXPAND SHEET to 10,000 rows
    console.log('Expanding sheet to 10,000 rows...');
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetId = spreadsheet.data.sheets.find(s => s.properties.title === 'Touches_Log').properties.sheetId;
    
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            requests: [
                { updateSheetProperties: { 
                    properties: { sheetId: sheetId, gridProperties: { rowCount: 10000 } },
                    fields: 'gridProperties.rowCount'
                }}
            ]
        }
    });

    // 2. Fetch Users List
    const usersRes = await fetch(`https://${AMO_DOMAIN}/api/v4/users`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const usersData = await usersRes.json();
    const usersMap = {};
    usersData?._embedded?.users?.forEach(u => { usersMap[u.id] = u.name; });

    let page = 1;
    let currentRowOffset = 2; // Rows 2 to 10000

    while (true) {
        console.log(`\n--- Page ${page} (Replicating) ---`);
        const leadsRes = await fetch(`https://${AMO_DOMAIN}/api/v4/leads?limit=50&page=${page}&filter[pipeline_id]=8696950`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });

        if (leadsRes.status === 204) break;
        const data = await leadsRes.json();
        const leads = data?._embedded?.leads || [];
        if (leads.length === 0) break;

        const batchRows = [];

        for (const lead of leads) {
            try {
                process.stdout.write(`L-${lead.id} `);
                
                const tasksRes = await fetch(`https://${AMO_DOMAIN}/api/v4/tasks?filter[entity_id]=${lead.id}&filter[is_completed]=1`, {
                    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
                });
                
                let touchTasks = [];
                if (tasksRes.status === 200) {
                    const data = await tasksRes.json();
                    touchTasks = (data?._embedded?.tasks || []).filter(t => t.task_type_id === 1);
                }

                const total = touchTasks.length;
                let rt = 0;
                if (total > 0) {
                    const first = touchTasks.sort((a,b) => a.updated_at - b.updated_at)[0];
                    rt = Math.round((first.updated_at - lead.created_at) / 60);
                }

                const brokerName = usersMap[lead.responsible_user_id] || "System";
                batchRows.push([ lead.id, brokerName, total, rt ]);
                await sleep(50); 
            } catch (err) { console.error(` [FAILED: ${err.message}] `); }
        }

        // Save immediately
        if (batchRows.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `Touches_Log!A${currentRowOffset}`,
                valueInputOption: 'RAW',
                requestBody: { values: batchRows }
            });
            currentRowOffset += batchRows.length;
            console.log(`+${batchRows.length} rows.`);
        }

        page++;
        // Stop after 20 pages for the initial history sync to avoid massive delay, 
        // User can rerun if they need older leads.
        if (page > 30) break; 
    }
    console.log('\n--- ✅ TOTAL REPLICATION FINISHED! ---');
}

totalSync().catch(console.error);
