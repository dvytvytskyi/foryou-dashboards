import { google } from 'googleapis';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'department_performance_all';
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({ projectId: PROJECT_ID, keyFilename: SERVICE_ACCOUNT_FILE });

const SOURCES = {
    'Первичка': { id: '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE', sheet: 'Real Estate', incomeCol: 16, dateCol: 1, sourceCol: 24 }, // Assuming index 24 is '@' or source
    'Вторичка': { id: '1msV2WTD7QwBaOuX2EySRm7a9M8g5pxL7xtk4AHsRDEA', sheet: 'Лист1', incomeCol: 14, dateCol: 0, sourceCol: 15 },
    'Сопровождение': { id: '1-ttYBdON2J_I-6dmdeC6sQb_pgH804RXekxJ0QDOhYw', sheet: 'Лист1', incomeCol: 13, dateCol: 0, sourceCol: 2 }
};

async function syncUnified() {
    console.log('--- 🚀 Starting UNIFIED DEPARTMENT SYNC ---');
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    let allData = [];

    // 1. Fetch from 3 specific files
    for (const [name, cfg] of Object.entries(SOURCES)) {
        console.log(`Fetching ${name}...`);
        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: cfg.id,
                range: `${cfg.sheet}!A2:Z1000`,
            });
            const rows = res.data.values || [];
            rows.forEach(r => {
                const income = parseAmount(r[cfg.incomeCol]);
                if (income > 0) {
                    allData.push({
                        date: parseDate(r[cfg.dateCol]),
                        department: name,
                        source: r[cfg.sourceCol] || 'Unknown',
                        income: income,
                        deals_count: 1
                    });
                }
            });
        } catch (e) {
            console.error(`Error in ${name}:`, e.message);
        }
    }

    // 2. Fetch Rent from Master
    console.log('Fetching Rent from Master...');
    const masterRes = await sheets.spreadsheets.values.get({
        spreadsheetId: '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY',
        range: 'A2:P500',
    });
    const masterRows = masterRes.data.values || [];
    masterRows.forEach(r => {
        if (r[2] === 'Аренда') {
            allData.push({
                date: parseDate(r[0]),
                department: 'Аренда',
                source: r[13] || 'Unknown',
                income: parseAmount(r[15]),
                deals_count: 1
            });
        }
    });

    const schema = [
        { name: 'date', type: 'TIMESTAMP' },
        { name: 'department', type: 'STRING' },
        { name: 'source', type: 'STRING' },
        { name: 'income', type: 'FLOAT' },
        { name: 'deals_count', type: 'INTEGER' }
    ];

    const table = bq.dataset(DATASET_ID).table(TABLE_ID);
    try { await table.delete(); } catch(e) {}
    await bq.dataset(DATASET_ID).createTable(TABLE_ID, { schema });
    await table.insert(allData);

    console.log(`--- ✅ UNIFIED SYNC COMPLETE (${allData.length} entries) ---`);
}

function parseDate(d) {
    if (!d) return null;
    const parts = d.split('.');
    if (parts.length < 3) return null;
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return new Date(`${year}-${parts[1]}-${parts[0]}`).toISOString();
}

function parseAmount(a) {
    if (!a) return 0;
    const clean = a.toString().replace(/\s/g, '').replace('AED', '').replace(',', '.').replace(/[^0-9.]/g, '');
    return parseFloat(clean) || 0;
}

syncUnified().catch(console.error);
