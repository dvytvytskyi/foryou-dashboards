import { google } from 'googleapis';
import path from 'path';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const TARGET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY'; // Analytics Core

async function aggregatePNL() {
    console.log('--- STARTING PRO P&L AGGREGATION ---');
    
    // 1. Get Income from Master Feed
    const incRes = await sheets.spreadsheets.values.get({ spreadsheetId: TARGET_ID, range: 'Global_Master_Feed!A2:K10000' });
    const incomes = incRes.data.values || [];
    
    // 2. Get Expenses from Categories Feed (from OTCHET)
    const expRes = await sheets.spreadsheets.values.get({ spreadsheetId: TARGET_ID, range: 'Global_Expense_Categories!A2:E200' });
    const expenses = expRes.data.values || [];

    const stats = {}; // { '2026-02': { inc: 0, exp: 0, brokers: Set } }

    // Aggregate Income
    incomes.forEach(r => {
        let m = (r[0] || '').toString().slice(0, 7);
        if (m && m.length === 7) {
            if (!stats[m]) stats[m] = { inc: 0, exp: 0, brokers: new Set() };
            stats[m].inc += parseFloat((r[8] || '0').replace(/\s/g, '').replace(',', '.'));
            
            const broker = (r[5] || '').trim();
            if (broker && !broker.toLowerCase().includes('partner')) {
                stats[m].brokers.add(broker);
            }
        }
    });

    // Aggregate Expenses
    expenses.forEach(r => {
        let m = (r[0] || '').toString().slice(0, 7);
        if (m && m.length === 7) {
            if (!stats[m]) stats[m] = { inc: 0, exp: 0, brokers: new Set() };
            stats[m].exp += parseFloat((r[4] || '0').replace(/\s/g, '').replace(',', '.'));
        }
    });

    // Final Table Generation
    const resultRows = [
        ['Месяц', 'Общий Доход (AED)', 'Общие Расходы (AED)', 'Чистая Прибыль (AED)', 'ROI (%)', 'Активных брокеров', 'Расход на 1 брокера (AED)']
    ];

    const sortedMonths = Object.keys(stats).sort().reverse();
    sortedMonths.forEach(m => {
        const s = stats[m];
        const profit = s.inc - s.exp;
        const roi = s.exp > 0 ? (profit / s.exp) * 100 : 0;
        const bCount = s.brokers.size || 1;
        const costPerHead = s.exp / bCount;
        
        resultRows.push([
            m, 
            s.inc.toFixed(2), 
            s.exp.toFixed(2), 
            profit.toFixed(2), 
            roi.toFixed(2) + '%',
            bCount,
            costPerHead.toFixed(2)
        ]);
    });

    // Upload to dedicated P&L sheet
    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: TARGET_ID,
            resource: { requests: [{ addSheet: { properties: { title: 'Global_PNL_Final' } } }] }
        });
    } catch (e) {}

    await sheets.spreadsheets.values.clear({ spreadsheetId: TARGET_ID, range: 'Global_PNL_Final!A1:Z100' });
    await sheets.spreadsheets.values.update({
        spreadsheetId: TARGET_ID, range: 'Global_PNL_Final!A1',
        valueInputOption: 'USER_ENTERED', resource: { values: resultRows },
    });

    console.log('--- PRO P&L COMPLETE ---');
}

aggregatePNL().catch(console.error);
