import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const SHEETS_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const SPREADSHEET_ID = '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg';
const TARGET_GID = '988567419';

const auth = new google.auth.GoogleAuth({
    keyFile: SHEETS_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

async function findSheet() {
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = res.data.sheets.find(s => s.properties.sheetId.toString() === TARGET_GID);
    if (sheet) {
        console.log(`--- FOUND SHEET ---`);
        console.log(`Title: '${sheet.properties.title}'`);
    } else {
        console.log(`--- SHEET NOT FOUND BY GID ---`);
    }
}
findSheet().catch(console.error);
