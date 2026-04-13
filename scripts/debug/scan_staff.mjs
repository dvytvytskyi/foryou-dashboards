import { google } from 'googleapis';
import path from 'path';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const BUHG_ID = '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE';

async function scanBuhgSheets() {
    console.log('--- SCANNING BUHG SHEET CONTENT FOR BROKER LIST ---');
    
    // Check "Сделки сотрудников" as it might have a master list of names
    const res1 = await sheets.spreadsheets.values.get({ spreadsheetId: BUHG_ID, range: 'Сделки сотрудников!A1:Z100' });
    console.log('--- Staff Preview in "Сделки сотрудников" ---');
    console.log(res1.data.values ? res1.data.values[0] : 'Empty');

    // Check OP_REESTR too
    const OP_ID = '1vbxQZS2HA6QmgR6Wnl86LLdR_-96VV-gKoX2NX99Zpk';
    const res2 = await sheets.spreadsheets.values.get({ spreadsheetId: OP_ID, range: 'Реестр!A1:Z5' });
    console.log('--- OP_REESTR Columns ---');
    console.log(res2.data.values ? res2.data.values[0] : 'Empty');
}

scanBuhgSheets().catch(console.error);
