import { google } from 'googleapis';
import path from 'path';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const BUHG_ID = '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE';
const TARGET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY'; // Analytics Core

const n = (val) => {
    if (!val) return 0;
    const firstLine = val.toString().split(/[\n\r]/)[0].trim();
    return parseFloat(firstLine.replace(/\s/g, '').replace(' ', '').replace(',', '.') || 0);
};

// Helper to extract date from string (e.g., "12.01", "Выдача 31.01")
function extractDate(str) {
    const match = (str || '').match(/(\d{1,2})\.(\d{1,2})/);
    if (match) {
        let d = match[1].padStart(2, '0');
        let m = match[2].padStart(2, '0');
        return `2024-${m}-${d}`;
    }
    return '2024-02-01'; // Default to February as per target headers found
}

async function syncExpenses() {
    console.log('--- Starting Expense Feed Sync ---');
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: BUHG_ID, range: 'Расходы!A1:Z500' });
    const rows = res.data.values || [];
    if (rows.length < 2) return;

    const peopleHeaders = rows[0]; // Artem, Nikita, Gulnoza...
    const dataRows = rows.slice(2);
    
    let expenses = [];
    
    // Each person has 3 columns (Description, Sum, Blank)
    for (let c = 0; c < peopleHeaders.length; c += 3) {
        const person = peopleHeaders[c] || 'Other';
        if (person === '') continue;

        dataRows.forEach(r => {
            const desc = r[c];
            const sum = n(r[c + 1]);
            if (sum > 0) {
                expenses.push([
                    extractDate(desc),
                    person,
                    desc,
                    sum
                ]);
            }
        });
    }

    console.log(`Unpivoted to ${expenses.length} expense records.`);

    // Upload to Analytics Core
    const targetValues = [
        ['Дата', 'Кто', 'Описание', 'Сумма'],
        ...expenses
    ];

    await sheets.spreadsheets.values.clear({ spreadsheetId: TARGET_ID, range: 'Global_Expense_Feed!A1:Z5000' });
    await sheets.spreadsheets.values.update({
        spreadsheetId: TARGET_ID, range: 'Global_Expense_Feed!A1',
        valueInputOption: 'USER_ENTERED', resource: { values: targetValues },
    });
    
    console.log('--- Expense Feed Sync Complete ---');
}

syncExpenses().catch(console.error);
