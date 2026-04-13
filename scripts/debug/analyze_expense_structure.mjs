import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
    keyFile: 'secrets/crypto-world-epta-2db29829d55d.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const BUHG_ID = '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE';

async function checkExpenseStructure() {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: BUHG_ID, range: 'Расходы!A1:Z20' });
    console.log('--- FIRST 20 ROWS OF EXPENSES ---');
    res.data.values.forEach((r, i) => console.log(`${i}:`, r));
}

checkExpenseStructure();
