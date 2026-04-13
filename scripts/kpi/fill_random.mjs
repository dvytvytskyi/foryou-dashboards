import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const SHEET_NAME = '[Working File]  KPI_Targets_Source';

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

async function fillRandomKpis() {
    console.log(`--- FILLING RANDOM DATA IN "${SHEET_NAME}" ---`);
    if (!fs.existsSync(AMO_TOKENS_FILE)) return;
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    const domain = 'reforyou.amocrm.ru';
    
    const usersRes = await fetch(`https://${domain}/api/v4/users`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const usersData = await usersRes.json();
    const users = usersData._embedded?.users || [];

    const values = users.map(u => {
        const leads = Math.floor(Math.random() * 45) + 40; 
        const deals = Math.floor(Math.random() * 4) + 2;   
        const revenue = (Math.floor(Math.random() * 27) + 8) * 10000; 
        const qual = ['A', 'B', 'B', 'A', 'C'][Math.floor(Math.random() * 5)];
        
        return [ '2026-03-01', u.name, leads, deals, revenue, qual ];
    });

    if (values.length === 0) return;

    // Headers too just in case
    const headers = [['Month (YYYY-MM-01)', 'Broker Name', 'Target Leads', 'Target Deals', 'Target Revenue', 'CRM Quality (A/B/C)']];

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: headers.concat(values) }
    });

    console.log('Sheet populated successfully.');
}

fillRandomKpis().catch(console.error);
