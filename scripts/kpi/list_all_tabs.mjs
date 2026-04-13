import { google } from 'googleapis';
import path from 'path';

const MASTER_SHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const sheets = google.sheets({ version: 'v4', auth });

async function listTabs() {
    console.log('--- ALL TABS IN SPREADSHEET 1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY ---');
    const res = await sheets.spreadsheets.get({ spreadsheetId: MASTER_SHEET_ID });
    res.data.sheets.forEach(s => console.log(`- ${s.properties.title}`));
}

listTabs().catch(console.error);
