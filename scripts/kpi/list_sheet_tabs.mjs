import { google } from 'googleapis';
import path from 'path';

const SPREADSHEEET_ID = process.argv[2];
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const sheets = google.sheets({ version: 'v4', auth });

async function listTabs() {
    const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEEET_ID });
    console.log('--- SHEETS IN THIS DOCUMENT ---');
    res.data.sheets.forEach(s => {
        console.log(`Title: ${s.properties.title} (ID: ${s.properties.sheetId})`);
    });
}
listTabs().catch(console.error);
