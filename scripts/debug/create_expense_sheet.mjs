import { google } from 'googleapis';
import path from 'path';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const TARGET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';

async function createExpenseSheet() {
    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: TARGET_ID,
            resource: {
                requests: [{
                    addSheet: { properties: { title: 'Global_Expense_Feed' } }
                }]
            }
        });
        console.log('--- ✅ Global_Expense_Feed Sheet Created ---');
    } catch (e) {
        console.log('Sheet might already exist.');
    }
}

createExpenseSheet();
