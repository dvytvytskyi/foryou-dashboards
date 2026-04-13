import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const SHEETS_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const SPREADSHEET_ID = '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg';
const auth = new google.auth.GoogleAuth({
    keyFile: SHEETS_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

async function inspect() {
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Детализация расход!A1:E5' });
    console.log('--- HEADER CHECK ---');
    console.log(JSON.stringify(res.data.values[0], null, 2));
    console.log('--- DATA CHECK ---');
    console.log(JSON.stringify(res.data.values[1], null, 2));
}
inspect().catch(console.error);
