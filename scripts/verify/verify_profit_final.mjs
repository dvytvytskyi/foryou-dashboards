import { google } from 'googleapis';
import path from 'path';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const TARGET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';

async function verifyProfit() {
    console.log('--- FINAL AUDIT FEBRUARY DATA ---');
    
    // 1. Get Expenses
    const expRes = await sheets.spreadsheets.values.get({ spreadsheetId: TARGET_ID, range: 'Global_Expense_Categories!A2:E20' });
    const expenses = expRes.data.values || [];
    let febExp = 0;
    expenses.forEach(r => {
        if (r[0] && r[0].includes('2026-02')) febExp += parseFloat((r[4] || '0').replace(/\s/g, '').replace(',', '.'));
    });
    console.log(`Current Month Expenses: ${febExp}`);

    // 2. Get Income
    const incRes = await sheets.spreadsheets.values.get({ spreadsheetId: TARGET_ID, range: 'Global_Master_Feed!A2:K3000' });
    const incomes = incRes.data.values || [];
    let febInc = 0;
    incomes.forEach(r => {
        if (r[0] && r[0].includes('2026-02')) {
            const val = parseFloat((r[8] || '0').replace(/\s/g, '').replace(',', '.'));
            if (!isNaN(val)) febInc += val;
        }
    });
    console.log(`Current Month Income: ${febInc}`);
    console.log(`REAL NET PROFIT: ${febInc - febExp} AED`);
}

verifyProfit();
