import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

async function deployBrokersToSheet() {
    console.log('--- REFRESHING BROKERS IN SHEET ---');
    if (!fs.existsSync(AMO_TOKENS_FILE)) return;
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    const domain = 'reforyou.amocrm.ru';
    
    // Using simple fetch to identify users
    const usersRes = await fetch(`https://${domain}/api/v4/users`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    const data = await usersRes.json();
    console.log('Users found:', data._embedded?.users?.length);

    const brokers = data._embedded?.users?.map(u => [ 
        '2026-03-01', 
        u.name, 
        0, 
        0, 
        0, 
        'A' 
    ]) || [];

    if (brokers.length === 0) {
        console.error('API Response empty for brokers.');
        return;
    }

    // Write to Sheet
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'KPI_Targets_Source!A2',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: brokers }
    });

    console.log(`Brokers deployed: ${brokers.length}`);
}

deployBrokersToSheet().catch(console.error);
