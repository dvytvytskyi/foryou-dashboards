
import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';

/**
 * FULL SCAN ENGINE (v2.0) - ALL LEADS
 * AMO CRM (Tasks) -> GOOGLE SHEETS
 */

const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');
const AMO_TOKENS_FILE = path.join(process.cwd(), 'secrets/amo_tokens.json');
const AMO_DOMAIN = 'reforyou.amocrm.ru';

async function fullSync() {
    console.log('--- 🛡️ Starting FULL SCAN (ALL LEADS) ---');
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    const ads = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf8'));

    // Authenticate with Google
    const auth = new google.auth.GoogleAuth({
        credentials: { client_email: ads.client_email, private_key: ads.private_key },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    let page = 1;
    let allSheetRows = [];
    const LIMIT = 250; // Max per page

    while (true) {
        console.log(`\n--- Fetching Page ${page} (Leads) ---`);
        const leadsRes = await fetch(`https://${AMO_DOMAIN}/api/v4/leads?limit=${LIMIT}&page=${page}&filter[pipeline_id]=8696950`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });

        if (leadsRes.status === 204) {
            console.log('Reached end of data.');
            break;
        }

        const data = await leadsRes.json();
        const leads = data?._embedded?.leads || [];
        if (leads.length === 0) break;

        for (const lead of leads) {
            process.stdout.write(`Analyze ${lead.id}... `);

            const tasksRes = await fetch(`https://${AMO_DOMAIN}/api/v4/tasks?filter[entity_id]=${lead.id}&filter[is_completed]=1`, {
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            });
            
            let touchTasks = [];
            if (tasksRes.status !== 204) {
                const data = await tasksRes.json();
                touchTasks = (data?._embedded?.tasks || []).filter(t => t.task_type_id === 1);
            }

            const total = touchTasks.length;
            let rt = 0;
            if (total > 0) {
                const first = touchTasks.sort((a,b) => a.updated_at - b.updated_at)[0];
                rt = Math.round((first.updated_at - lead.created_at) / 60);
            }

            allSheetRows.push([ lead.id, "", total, rt ]);
            console.log(`OK (${total})`);
        }

        page++;
        // Safety break for testing thousands (optional)
        if (page > 20) break; 
    }

    console.log('\n--- Writing to Google Sheets (Bulk) ---');
    // Clear old data first (optional, safer to overwrite)
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Touches_Log!A2:D5000', 
        valueInputOption: 'RAW',
        requestBody: {
            values: allSheetRows
        }
    });

    console.log('--- ✅ FULL SCAN COMPLETE! Check your Google Sheet now! ---');
}

fullSync().catch(console.error);
