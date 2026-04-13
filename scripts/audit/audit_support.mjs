import { google } from 'googleapis';
import fs from 'fs';

const auth = new google.auth.GoogleAuth({
    keyFile: 'secrets/crypto-world-epta-2db29829d55d.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const BUHG_ID = '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE';

async function auditSupport() {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: BUHG_ID,
        range: 'Real Estate!A1:Z',
    });
    const rows = res.data.values;
    // Look for rows where department/category mentions "сопровождение" or similar
    const suspicious = rows.filter(r => r[2] && r[2].toLowerCase().includes('сопр'));
    console.log('Suspicious Support Rows in Buhg History:');
    suspicious.slice(0, 5).forEach(r => console.log(r));
}

auditSupport();
