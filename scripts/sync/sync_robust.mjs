
import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';

/**
 * ROBUST SCAN ENGINE (v2.1)
 * Optimized for AmoCRM limits & Auto-save to Google Sheets
 */

const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');
const AMO_TOKENS_FILE = path.join(process.cwd(), 'secrets/amo_tokens.json');
const AMO_DOMAIN = 'reforyou.amocrm.ru';

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function robustSync() {
    console.log('--- 🛡️ Starting ROBUST FULL SCAN ---');
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    const ads = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf8'));

    const auth = new google.auth.GoogleAuth({
        credentials: { client_email: ads.client_email, private_key: ads.private_key },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    let page = 1;
    let currentRowOffset = 2; // Google Sheets starts at row 2

    while (true) {
        console.log(`\n[PAGE ${page}] Fetching leads...`);
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
                process.stdout.write(`Lead ${lead.id}... `);
                
                // Get tasks
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

                batchRows.push([ lead.id, "", total, rt ]);
                console.log(`OK(${total})`);
                await sleep(50); // Be polite to the API
            } catch (err) {
                console.error(`\nSkip ${lead.id} due to error: ${err.message}`);
            }
        }

        // Write batch to Google Sheets IMMEDIATELY
        if (batchRows.length > 0) {
            console.log(`Saving batch of ${batchRows.length} rows...`);
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `Touches_Log!A${currentRowOffset}`, // Dynamic range
                valueInputOption: 'RAW',
                requestBody: { values: batchRows }
            });
            currentRowOffset += batchRows.length;
        }

        page++;
        if (page > 30) break; // Limit to 1500 leads for now
    }
    console.log('\n--- ✅ ALL DATA SAVED SUCCESSFULLY! ---');
}

robustSync().catch(console.error);
