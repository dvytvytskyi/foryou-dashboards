import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

/**
 * 📈 HISTORICAL INCOME SYNC (Google Sheets -> BigQuery)
 * Sheet: 'Real Estate' from 15MR... spreadsheet
 */

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'historical_financials';
const SPREADSHEET_ID = '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE';
const SHEET_NAME = 'Real Estate';

const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({ projectId: PROJECT_ID, keyFilename: SERVICE_ACCOUNT_FILE });

async function syncHistory() {
    console.log('--- 🚀 Starting HISTORICAL INCOME SYNC ---');
    
    // 1. Auth and Read Sheets
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:Z10000`, // Skip header
    });

    const rows = res.data.values || [];
    console.log(`Fetched ${rows.length} rows from Google Sheets.`);

    // 2. Format Data for BigQuery
    const formattedData = rows.map((row, index) => {
        // Skip empty rows
        if (!row[1]) return null; 

        try {
            return {
                date: parseDate(row[1]),
                department: row[2] || 'Unknown',
                client_name: row[3] || '',
                broker_name: row[4] || 'Unknown',
                referral_name: row[5] || '',
                object_value: parseAmount(row[6]),
                developer: row[7] || '',
                gross_commission: parseAmount(row[9]),
                net_company_income: parseAmount(row[16]), // Column Q
                status: row[18] || ''
            };
        } catch (e) {
            console.warn(`Row ${index + 2}: Skip due to error.`, e.message);
            return null;
        }
    }).filter(r => r !== null);

    console.log(`Formatted ${formattedData.length} valid rows.`);

    // 3. Upload to BigQuery
    const schema = [
        { name: 'date', type: 'TIMESTAMP' },
        { name: 'department', type: 'STRING' },
        { name: 'client_name', type: 'STRING' },
        { name: 'broker_name', type: 'STRING' },
        { name: 'referral_name', type: 'STRING' },
        { name: 'object_value', type: 'FLOAT' },
        { name: 'developer', type: 'STRING' },
        { name: 'gross_commission', type: 'FLOAT' },
        { name: 'net_company_income', type: 'FLOAT' },
        { name: 'status', type: 'STRING' }
    ];

    const table = bq.dataset(DATASET_ID).table(TABLE_ID);
    
    try { await table.delete(); } catch(e) {}
    await bq.dataset(DATASET_ID).createTable(TABLE_ID, { schema });

    console.log('Pushing to BigQuery...');
    await table.insert(formattedData);
    console.log('--- ✅ HISTORICAL SYNC COMPLETE ---');
}

function parseDate(d) {
    if (!d) return null;
    const parts = d.split('.');
    if (parts.length === 3) {
        // Handle DD.MM.YYYY
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString();
    }
    return new Date(d).toISOString();
}

function parseAmount(a) {
    if (!a) return 0;
    // Remove spaces, currency symbols, and handle Russian decimal commas
    const clean = a.replace(/\s/g, '').replace('$', '').replace('dh', '').replace(',', '.');
    return parseFloat(clean) || 0;
}

syncHistory().catch(console.error);
