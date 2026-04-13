import { google } from 'googleapis';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'monthly_roi_summary';
const SPREADSHEET_ID = '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg';
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({ projectId: PROJECT_ID, keyFilename: SERVICE_ACCOUNT_FILE });

async function syncROI() {
    console.log('--- 🚀 Starting MONTHLY ROI SYNC ---');
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    // Filter month sheets like 'ФЕВРАЛЬ 26', 'ЯНВАРЬ 26', 'ДЕКАБРЬ 25'
    const monthSheets = meta.data.sheets.filter(s => 
        s.properties.title.match(/(ЯНВАРЬ|ФЕВРАЛЬ|МАРТ|АПРЕЛЬ|МАЙ|ИЮНЬ|ИЮЛЬ|АВГУСТ|СЕНТЯБРЬ|ОКТЯБРЬ|НОЯБРЬ|ДЕКАБРЬ).*\d{2}/i)
    );

    const results = [];

    for (const sheet of monthSheets) {
        const title = sheet.properties.title;
        console.log(`Processing: ${title}`);
        
        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${title}!A1:F20`,
            });
            const rows = res.data.values || [];
            
            // Map rows based on structure:
            // OFF PLAN (Revenue) - Row 3 Col C
            // Secondary (Revenue) - Row 4 Col C (maybe empty)
            // Rent (Revenue) - Row 6 Col C
            // Support (Revenue) - Row 5 Col C
            // Marketing Spend (Cost) - Row 6 Col F (under "Реклама")
            
            const findValue = (label, colIdx) => {
                const row = rows.find(r => r[0] && r[0].toLowerCase().includes(label.toLowerCase()));
                return row ? parseAmount(row[colIdx]) : 0;
            };

            const data = {
                month_year: title,
                off_plan_income: findValue('OFF PLAN', 2),
                resale_income: findValue('Вторичка', 2),
                rent_income: findValue('Аренда', 2),
                support_income: findValue('Сопровождение', 2),
                marketing_spend: 0,
                total_income: 0
            };

            // Find Marketing Spend (column E is label, column F is value)
            const adsRow = rows.find(r => r[4] && r[4].toLowerCase().includes('реклама'));
            data.marketing_spend = adsRow ? parseAmount(adsRow[5]) : 0;

            const totalRow = rows.find(r => r[0] && r[0].toLowerCase() === 'итого');
            data.total_income = totalRow ? parseAmount(totalRow[2]) : 0;

            results.push(data);
        } catch (e) {
            console.error(`Error in ${title}:`, e.message);
        }
    }

    const schema = [
        { name: 'month_year', type: 'STRING' },
        { name: 'off_plan_income', type: 'FLOAT' },
        { name: 'resale_income', type: 'FLOAT' },
        { name: 'rent_income', type: 'FLOAT' },
        { name: 'support_income', type: 'FLOAT' },
        { name: 'marketing_spend', type: 'FLOAT' },
        { name: 'total_income', type: 'FLOAT' }
    ];

    const table = bq.dataset(DATASET_ID).table(TABLE_ID);
    try { await table.delete(); } catch(e) {}
    await bq.dataset(DATASET_ID).createTable(TABLE_ID, { schema });
    await table.insert(results);

    console.log(`--- ✅ ROI SYNC COMPLETE (${results.length} months) ---`);
}

function parseAmount(a) {
    if (!a) return 0;
    const clean = a.toString().replace(/\s/g, '').replace(',', '.').replace(/[^0-9.]/g, '');
    return parseFloat(clean) || 0;
}

syncROI().catch(console.error);
