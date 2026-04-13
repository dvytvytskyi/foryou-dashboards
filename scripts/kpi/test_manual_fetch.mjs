import { google } from 'googleapis';
import path from 'path';

const SPREADSHEEET_ID = '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const sheets = google.sheets({ version: 'v4', auth });

async function manualFetch() {
    console.log('Fetching sheet data manually...');
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEEET_ID,
            range: 'ФЕВРАЛЬ 26!A1:F50',
            majorDimension: 'ROWS'
        });
        console.log('DATA:', JSON.stringify(res.data.values, null, 2));
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}
manualFetch();
