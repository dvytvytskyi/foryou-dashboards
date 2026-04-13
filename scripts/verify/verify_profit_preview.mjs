import { google } from 'googleapis';
import path from 'path';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const TARGET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';

async function verifyProfit() {
    console.log('--- PREVIEW ROWS ---');
    
    const incRes = await sheets.spreadsheets.values.get({ spreadsheetId: TARGET_ID, range: 'Global_Master_Feed!A1:A5' });
    console.log('Master Feed Month_Keys:', incRes.data.values);

    const expRes = await sheets.spreadsheets.values.get({ spreadsheetId: TARGET_ID, range: 'Global_Expense_Categories!A1:A5' });
    console.log('Expense Categories Month_Keys:', expRes.data.values);
}

verifyProfit();
