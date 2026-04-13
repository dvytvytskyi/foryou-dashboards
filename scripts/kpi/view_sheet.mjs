import { google } from 'googleapis';
import path from 'path';

const SPREADSHEEET_ID = process.argv[2];
const RANGE = process.argv[3];
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const sheets = google.sheets({ version: 'v4', auth });

async function viewSheet() {
    console.log(`Reading Spreadsheet ID: ${SPREADSHEEET_ID}`);
    console.log(`Range: ${RANGE}`);
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEEET_ID,
            range: RANGE
        });
        const rows = res.data.values;
        if (rows) {
            console.log(`Found ${rows.length} rows.`);
            rows.forEach((row, i) => {
                console.log(`${i}: ${row.join(' | ')}`);
            });
        } else {
            console.log('No data found in range.');
        }
    } catch (e) {
        console.error('ERROR reading sheet:', e.message);
    }
}
viewSheet().catch(console.error);
