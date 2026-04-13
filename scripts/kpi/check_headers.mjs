import { google } from 'googleapis';
import path from 'path';

const FINANCE_ID = '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg';
const PARTNERSHIP_ID = '1vbxQZS2HA6QmgR6Wnl86LLdR_-96VV-gKoX2NX99Zpk';
const SECONDARY_ID = '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE';
const LISTING_ID = '1msV2WTD7QwBaOuX2EySRm7a9M8g5pxL7xtk4AHsRDEA';

const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const sheets = google.sheets({ version: 'v4', auth });

async function checkHeaders() {
    console.log('--- CHECKING HEADERS ---');
    
    const h1 = await sheets.spreadsheets.values.get({ spreadsheetId: PARTNERSHIP_ID, range: 'Февраль!A1:Z1' });
    console.log('Partnership Headers:', h1.data.values?.[0]);

    const h2 = await sheets.spreadsheets.values.get({ spreadsheetId: LISTING_ID, range: 'Лист1!A1:Z1' });
    console.log('Listing Headers:', h2.data.values?.[0]);

    const h3 = await sheets.spreadsheets.values.get({ spreadsheetId: SECONDARY_ID, range: 'Real Estate!A1:Z1' });
    console.log('Secondary Headers:', h3.data.values?.[0]);
}

checkHeaders().catch(console.error);
