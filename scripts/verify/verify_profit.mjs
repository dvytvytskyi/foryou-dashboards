import { google } from 'googleapis';
import path from 'path';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const TARGET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';

async function verifyProfit() {
    console.log('--- DEBUGGING PROFIT VS EXPENSES ---');
    
    // 1. Get Expenses for February
    const expRes = await sheets.spreadsheets.values.get({ spreadsheetId: TARGET_ID, range: 'Global_Expense_Categories!A1:E100' });
    const expenses = expRes.data.values || [];
    let febExp = 0;
    expenses.forEach(r => {
        if (r[0] === '2026-02') febExp += parseFloat(r[4] || 0);
    });
    console.log(`Total Feb Expenses: ${febExp}`);

    // 2. Get Income for February
    const incRes = await sheets.spreadsheets.values.get({ spreadsheetId: TARGET_ID, range: 'Global_Master_Feed!A1:K5000' });
    const incomes = incRes.data.values || [];
    let febInc = 0;
    incomes.forEach(r => {
        if (r[0] === '2026-02') febInc += parseFloat((r[9] || '0').replace(/\s/g, '').replace(',', '.'));
    });
    console.log(`Total Feb Income in Master Feed: ${febInc}`);
    console.log(`Calculated Net: ${febInc - febExp}`);
}

verifyProfit();
