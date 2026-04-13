import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

async function createPerformanceSheet() {
    console.log('--- CREATING GLOBAL PERFORMANCE SOURCE SHEET ---');
    const title = 'Global_Performance_Source';
    
    // 1. Create the sheet
    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [{ addSheet: { properties: { title } } }]
            }
        });
    } catch (e) {
        console.log('Sheet might already exist, proceeding to update headers.');
    }

    // 2. Set Headers and initial Sources from screenshot
    const headers = [
        ['Month (YYYY-MM-01)', 'Источник', 'Расходы (Spend)', 'К-во сделок (Deals)', 'Выручка (Revenue Gross)', 'Доход (Income Net)']
    ];

    const initialSources = [
        ['2026-03-01', 'Собственный клиент', 0, 0, 0, 0],
        ['2026-03-01', 'Листинг', 0, 0, 0, 0],
        ['2026-03-01', 'Собственный лид', 0, 0, 0, 0],
        ['2026-03-01', 'Лид PF', 0, 0, 0, 0],
        ['2026-03-01', 'Лид Utube', 0, 0, 0, 0],
        ['2026-03-01', 'Лид RED', 0, 0, 0, 0],
        ['2026-03-01', 'Ереван', 0, 0, 0, 0],
        ['2026-03-01', 'Лид компании', 0, 0, 0, 0],
        ['2026-03-01', 'Банк', 0, 0, 0, 0],
        ['2026-03-01', 'Facebook', 0, 0, 0, 0]
    ];

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${title}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: headers.concat(initialSources) }
    });

    console.log('Master Performance sheet created successfully.');
}

createPerformanceSheet().catch(console.error);
