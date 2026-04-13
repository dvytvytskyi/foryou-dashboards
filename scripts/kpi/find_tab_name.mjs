import { google } from 'googleapis';
import path from 'path';

const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});
const sheets = google.sheets({ version: 'v4', auth });

async function findTab() {
    const ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
    const res = await sheets.spreadsheets.get({ spreadsheetId: ID });
    const sheet = res.data.sheets.find(s => s.properties.sheetId === 1085387981);
    console.log('TAB NAME:', sheet.properties.title);
    
    // Read first 10 rows
    const data = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: sheet.properties.title + '!A1:Z20' });
    console.log('DATA:', JSON.stringify(data.data.values, null, 2));
}

findTab().catch(console.error);
