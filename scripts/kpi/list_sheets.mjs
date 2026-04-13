import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const SHEETS_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const SPREADSHEET_ID = '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg';
const auth = new google.auth.GoogleAuth({
    keyFile: SHEETS_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

async function listSheets() {
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    console.log('--- SHEET LIST ---');
    res.data.sheets.forEach(s => console.log(`- '${s.properties.title}'`));
}
listSheets().catch(console.error);
