import { google } from 'googleapis';
import path from 'path';

const FINANCE_SPREADSHEET_ID = '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const sheets = google.sheets({ version: 'v4', auth });

async function inspectFinanceSheet() {
    console.log('--- INSPECTING FINANCE SHEET (ФЕВРАЛЬ 26) ---');
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: FINANCE_SPREADSHEET_ID,
            range: 'ФЕВРАЛЬ 26!A1:L40'
        });
        
        const rows = res.data.values;
        if (!rows) {
            console.log('No data found.');
            return;
        }

        // Print sample to see coordinates
        rows.forEach((row, i) => {
            console.log(`${i+1}: ${row.join(' | ')}`);
        });
    } catch (e) {
        console.error('Error reading sheet:', e.message);
    }
}

inspectFinanceSheet().catch(console.error);
