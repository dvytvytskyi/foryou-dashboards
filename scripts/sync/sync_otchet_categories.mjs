import { google } from 'googleapis';
import path from 'path';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const OTCHET_ID = '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg';
const TARGET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY'; // Analytics Core

const n = (val) => {
    if (!val) return 0;
    const firstLine = val.toString().split(/[\n\r]/)[0].trim();
    return parseFloat(firstLine.replace(/\s/g, '').replace(' ', '').replace(',', '.') || 0);
};

async function syncOtchet() {
    console.log('--- Starting OTCHET Category Sync ---');
    
    // We'll scan February 2026 and hopefully others if structure is same
    const tabs = ['ФЕВРАЛЬ 26', 'ЯНВАРЬ 26', 'ДЕКАБРЬ 25'];
    
    let allExpenses = [];
    
    for (const tab of tabs) {
        try {
            const res = await sheets.spreadsheets.values.get({ spreadsheetId: OTCHET_ID, range: `${tab}!E1:G10` });
            const rows = res.data.values || [];
            
            // Category mapping based on Excel layout: Col E Name, Col F Amount
            // E3: Salary, E4: Real Estate DBs, etc.
            // Let's identify the month for the date field
            const yearMatch = tab.match(/\d{2}/);
            const year = yearMatch ? `20${yearMatch[0]}` : '2026';
            const month = tab.includes('ФЕВРАЛЬ') ? '02' : tab.includes('ЯНВАРЬ') ? '01' : '12';
            const dateStr = `${year}-${month}-01`;

            rows.forEach((r, i) => {
                const category = (r[0] || '').trim();
                const sum = n(r[1]);
                if (sum > 0 && i >= 2 && i <= 7) { // Rows 3 to 8
                    allExpenses.push([dateStr.slice(0, 7), dateStr, category, 'Aggregated from Otchet', sum]);
                }
            });
        } catch (e) {
            console.log(`Tab ${tab} not found or structure different.`);
        }
    }

    const targetValues = [
        ['Month_Key', 'Дата', 'Категория', 'Описание', 'Сумма'],
        ...allExpenses
    ];

    // 1. Ensure sheet exists
    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: TARGET_ID,
            resource: {
                requests: [{ addSheet: { properties: { title: 'Global_Expense_Categories' } } }]
            }
        });
        console.log('Created Global_Expense_Categories sheet.');
    } catch (e) {
        console.log('Sheet Global_Expense_Categories already exists.');
    }

    // 2. Clear old values
    await sheets.spreadsheets.values.clear({ spreadsheetId: TARGET_ID, range: 'Global_Expense_Categories!A1:Z1000' });

    // 3. Update with new values
    const response = await sheets.spreadsheets.values.update({
        spreadsheetId: TARGET_ID, range: 'Global_Expense_Categories!A1',
        valueInputOption: 'USER_ENTERED', resource: { values: targetValues },
    });
    
    console.log('--- OTCHET Sync Complete ---');
}

syncOtchet().catch(console.error);
