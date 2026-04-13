import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
    keyFile: 'secrets/crypto-world-epta-2db29829d55d.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const BUHG_ID = '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE';

async function findInBuhg() {
    const res = await sheets.spreadsheets.get({ spreadsheetId: BUHG_ID });
    console.log('Sheets in BUHG History:', res.data.sheets.map(s => s.properties.title));
}

findInBuhg();
