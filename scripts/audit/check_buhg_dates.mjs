import { google } from 'googleapis';
import path from 'path';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const BUHG_ID = '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE';

async function checkBuhg() {
    console.log('--- CHECKING BUHG HISTORY DATES ---');
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: BUHG_ID, range: '1-50!A1:B10' });
    console.log(res.data.values);
}

checkBuhg();
