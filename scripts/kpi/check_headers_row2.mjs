import { google } from 'googleapis';
import path from 'path';

const PARTNERSHIP_ID = '1vbxQZS2HA6QmgR6Wnl86LLdR_-96VV-gKoX2NX99Zpk';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const sheets = google.sheets({ version: 'v4', auth });

async function checkHeadersRow2() {
    console.log('--- CHECKING PARTNERSHIP HEADERS ROW 2 ---');
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: PARTNERSHIP_ID, range: 'Февраль!A2:Z2' });
    console.log('Partnership Headers Row 2:', res.data.values?.[0]);
}

checkHeadersRow2().catch(console.error);
