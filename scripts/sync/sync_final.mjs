
import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';

/**
 * FINAL SYNC ENGINE (v1.0)
 * AMO CRM (Tasks) -> GOOGLE SHEETS (Automated via Service Account)
 */

const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');
const AMO_TOKENS_FILE = path.join(process.cwd(), 'secrets/amo_tokens.json');
const AMO_DOMAIN = 'reforyou.amocrm.ru';

async function sync() {
    console.log('--- 1. Reading Credentials ---');
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    const ads = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf8'));

    // Authenticate with Google
    const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: ads.client_email,
          private_key: ads.private_key
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('--- 2. Fetching Leads from AmoCRM ---');
    const leadsRes = await fetch(`https://${AMO_DOMAIN}/api/v4/leads?limit=50&filter[pipeline_id]=8696950`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const leadsData = await leadsRes.json();
    const leads = leadsData?._embedded?.leads || [];

    const sheetRows = [];

    for (const lead of leads) {
        process.stdout.write(`Syncing ${lead.id}... `);

        // Fetch tasks
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

        sheetRows.push([ lead.id, "", total, rt ]);
        console.log(`OK!`);
    }

    console.log('--- 3. Writing to Google Sheets ---');
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Touches_Log!A2', // Start from second row
        valueInputOption: 'RAW',
        requestBody: {
            values: sheetRows
        }
    });

    console.log('--- SYNC FINISHED! Data is now in your Google Sheet. ---');
}

sync().catch(console.error);
