import { google } from 'googleapis';
import path from 'path';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const BUHG_ID = '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE';

async function checkSheets() {
    console.log('--- PREVIEWING CANDIDATE SHEETS ---');
    
    try {
        const res1 = await sheets.spreadsheets.values.get({ spreadsheetId: BUHG_ID, range: 'Сделки сотрудников!A1:B10' });
        console.log('Сделки сотрудников:', res1.data.values);
    } catch(e) {}

    try {
        const res2 = await sheets.spreadsheets.values.get({ spreadsheetId: BUHG_ID, range: 'Бухгалтерия!A1:B10' });
        console.log('Бухгалтерия:', res2.data.values);
    } catch(e) {}
}

checkSheets();
