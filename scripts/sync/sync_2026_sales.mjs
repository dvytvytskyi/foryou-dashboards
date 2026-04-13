import { google } from 'googleapis';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'sales_2026_stats';
const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({ projectId: PROJECT_ID, keyFilename: SERVICE_ACCOUNT_FILE });

async function sync2026() {
    console.log('--- 🚀 Syncing 2026 Sales Data (By Type) ---');
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'A2:P500', // P is "Доход компании (AED)"
    });

    const rows = res.data.values || [];
    const formatted = rows.map(r => {
        if (!r[0] || !r[2]) return null;
        return {
            date: parseDate(r[0]),
            broker_name: r[1] || 'Unknown',
            deal_type: r[2] || 'Unknown',
            object_name: r[3] || '',
            company_income: parseAmount(r[15]),
            lead_source: r[13] || 'Unknown'
        };
    }).filter(r => r !== null);

    const schema = [
        { name: 'date', type: 'TIMESTAMP' },
        { name: 'broker_name', type: 'STRING' },
        { name: 'deal_type', type: 'STRING' },
        { name: 'object_name', type: 'STRING' },
        { name: 'company_income', type: 'FLOAT' },
        { name: 'lead_source', type: 'STRING' }
    ];

    const table = bq.dataset(DATASET_ID).table(TABLE_ID);
    try { await table.delete(); } catch(e) {}
    await bq.dataset(DATASET_ID).createTable(TABLE_ID, { schema });
    await table.insert(formatted);

    console.log(`--- ✅ 2026 SYNC COMPLETE (${formatted.length} deals) ---`);
}

function parseDate(d) {
    if (!d) return null;
    const parts = d.split('.');
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString();
}

function parseAmount(a) {
    if (!a) return 0;
    const clean = a.toString().replace(/\s/g, '').replace('AED', '').replace(',', '.').replace(/[^0-9.]/g, '');
    return parseFloat(clean) || 0;
}

sync2026().catch(console.error);
