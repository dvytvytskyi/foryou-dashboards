import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
    keyFile: 'secrets/crypto-world-epta-2db29829d55d.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const CORE_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';

async function findExpenses() {
    const res = await sheets.spreadsheets.get({ spreadsheetId: CORE_ID });
    console.log('Sheets in Analytics Core:', res.data.sheets.map(s => s.properties.title));
}

findExpenses();
