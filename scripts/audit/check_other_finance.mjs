import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
    keyFile: 'secrets/crypto-world-epta-2db29829d55d.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const BUHG_ID = '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE';

async function checkOtherSheets() {
    const resFin = await sheets.spreadsheets.values.get({ spreadsheetId: BUHG_ID, range: 'Finance!A1:Z5' });
    console.log('Finance Headers:', resFin.data.values?.[0]);
    
    const resBuh = await sheets.spreadsheets.values.get({ spreadsheetId: BUHG_ID, range: 'Бухгалтерия!A1:Z5' });
    console.log('Accounting Headers (Бухгалтерия):', resBuh.data.values?.[0]);
}

checkOtherSheets();
