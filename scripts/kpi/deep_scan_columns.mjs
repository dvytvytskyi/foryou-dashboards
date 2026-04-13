import { google } from 'googleapis';
import path from 'path';

const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEETS = [
    { id: '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg', name: 'Finance' },
    { id: '1vbxQZS2HA6QmgR6Wnl86LLdR_-96VV-gKoX2NX99Zpk', name: 'Partnership' },
    { id: '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE', name: 'Secondary Market' },
    { id: '1msV2WTD7QwBaOuX2EySRm7a9M8g5pxL7xtk4AHsRDEA', name: 'Listing' },
    { id: '1-ttYBdON2J_I-6dmdeC6sQb_pgH804RXekxJ0QDOhYw', name: 'Global Summary' }
];

async function deepScan() {
    console.log('--- DEEP SCANNING ALL SPREADSHEETS FOR SOURCES ---');
    for (const ss of SPREADSHEETS) {
        console.log(`Scanning [${ss.name}]...`);
        try {
            const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: ss.id });
            const sheetNames = spreadsheet.data.sheets.map(s => s.properties.title);
            console.log(`- Sheets: ${sheetNames.slice(0, 3).join(', ')}...`);
            
            // Try to read first sheet's headers to find source columns
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: ss.id,
                range: `${sheetNames[0]}!A1:Z5`
            });
            const headers = res.data.values?.[0] || [];
            console.log(`- Headers: ${headers.join(', ').slice(0, 100)}...`);
        } catch (e) {
            console.error(`- Error reading [${ss.name}]: ${e.message}`);
        }
    }
}

deepScan().catch(console.error);
