import { google } from 'googleapis';
import path from 'path';

const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const sheets = google.sheets({ version: 'v4', auth });

const PARTNERSHIP_ID = '1vbxQZS2HA6QmgR6Wnl86LLdR_-96VV-gKoX2NX99Zpk';
const LISTING_ID = '1msV2WTD7QwBaOuX2EySRm7a9M8g5pxL7xtk4AHsRDEA';

async function analyzeFebruary() {
    console.log('--- ANALYZING FEBRUARY SALES BY SOURCE ---');
    
    // Read Partnership February
    const pRes = await sheets.spreadsheets.values.get({
        spreadsheetId: PARTNERSHIP_ID,
        range: 'Февраль!A1:Z100'
    });
    
    // Read Listing
    const lRes = await sheets.spreadsheets.values.get({
        spreadsheetId: LISTING_ID,
        range: 'Лист1!A1:Z100'
    });

    console.log('Partnership (Feb) Sample:', pRes.data.values?.[0]?.join(', ') || 'No data');
    console.log('Listing Sample:', lRes.data.values?.[1]?.join(', ') || 'No data');
}

analyzeFebruary().catch(console.error);
