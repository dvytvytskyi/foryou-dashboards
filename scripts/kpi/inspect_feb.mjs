import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const SHEETS_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const SPREADSHEET_ID = '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg';
const auth = new google.auth.GoogleAuth({
    keyFile: SHEETS_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

async function inspectFeb() {
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'ФЕВРАЛЬ 26!A1:Z10' });
    console.log('--- FEB 26 HEADER ---');
    console.log(JSON.stringify(res.data.values[0], null, 2));
    console.log('--- FEB 26 ROW Example ---');
    console.log(JSON.stringify(res.data.values[5], null, 2));
}
inspectFeb().catch(console.error);
