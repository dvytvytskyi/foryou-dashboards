import { google } from 'googleapis';
import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';
import fs from 'fs';

const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SHEET_NAME = '[Working File]  KPI_Targets_Source';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: SERVICE_ACCOUNT_FILE
});

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const sheets = google.sheets({ version: 'v4', auth });

async function syncSheetToBigQuery() {
    console.log('--- SYNCING GOOGLE SHEET TO BIGQUERY ---');
    
    // 1. Read from Sheet
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:F200`
    });

    const rows = res.data.values;
    if (!rows || rows.length === 0) {
        console.log('No data found in sheet.');
        return;
    }

    // 2. Format for BigQuery
    const bqRows = rows.map(r => ({
        month_key: r[0],
        broker_name: r[1],
        target_leads: parseInt(r[2]) || 0,
        target_deals: parseInt(r[3]) || 0,
        target_revenue: parseFloat(r[4]) || 0,
        crm_quality: r[5] || 'A',
        updated_at: new Date().toISOString()
    })).filter(r => r.broker_name && r.month_key);

    if (bqRows.length === 0) return;

    // 3. Insert into BigQuery (broker_kpi_targets)
    console.log(`Inserting ${bqRows.length} rows into BigQuery...`);
    await bq.dataset('foryou_analytics').table('broker_kpi_targets').insert(bqRows);

    console.log('SYNC SUCCESSFUL!');
}

syncSheetToBigQuery().catch(console.error);
