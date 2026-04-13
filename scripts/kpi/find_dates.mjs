import { google } from 'googleapis';
import path from 'path';

const LISTING_ID = '1msV2WTD7QwBaOuX2EySRm7a9M8g5pxL7xtk4AHsRDEA';
const SECONDARY_ID = '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const sheets = google.sheets({ version: 'v4', auth });

async function fullScanDates() {
    console.log('--- SCANNING ALL ROWS FOR LATEST DATES ---');
    
    const r1 = await sheets.spreadsheets.values.get({ spreadsheetId: LISTING_ID, range: 'Лист1!A1:A2000' });
    const dates1 = r1.data.values?.flat().filter(v => v && v.includes('.')).slice(-10);
    console.log('Listing Latest 10 Dates:', dates1);

    const r2 = await sheets.spreadsheets.values.get({ spreadsheetId: SECONDARY_ID, range: 'Real Estate!B1:B2000' });
    const dates2 = r2.data.values?.flat().filter(v => v && v.includes('.')).slice(-10);
    console.log('Secondary Latest 10 Dates:', dates2);
}

fullScanDates().catch(console.error);
