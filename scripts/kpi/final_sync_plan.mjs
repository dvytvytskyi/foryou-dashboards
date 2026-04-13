import { google } from 'googleapis';
import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const GID = 1085387981; // Tab where Plan is stored
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});
const sheets = google.sheets({ version: 'v4', auth });
const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function syncPlan() {
    console.log('--- SYNCING PLAN (KPI TARGETS) FROM GOOGLE SHEETS ---');
    
    // Find tab name by GID
    const ss = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = ss.data.sheets.find(s => s.properties.sheetId === GID);
    const tabName = sheet.properties.title;
    console.log('Targeting Tab:', tabName);

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tabName}!A2:F500`
    });

    const rows = res.data.values || [];
    const bqRows = rows.map(r => ({
        date: r[0],
        broker_name: r[1],
        target_leads: parseInt(r[2]) || 0,
        target_deals: parseInt(r[3]) || 0,
        target_revenue: parseFloat(r[4]) || 0,
        grade: r[5] || ''
    })).filter(r => r.date && r.broker_name);

    console.log(`Fetched ${bqRows.length} plan rows.`);

    const valuesStr = bqRows.map(r => 
        `(DATE '${r.date}', '${r.broker_name.replace(/'/g, "\\'")}', ${r.target_leads}, ${r.target_deals}, ${r.target_revenue}, '${r.grade}')`
    ).join(',\n');

    const query = `
        CREATE OR REPLACE TABLE \`crypto-world-epta.foryou_analytics.google_sheet_kpi_targets\` AS
        SELECT * FROM UNNEST([
            STRUCT<month_key DATE, broker_name STRING, target_leads INT64, target_deals INT64, target_revenue FLOAT64, grade STRING>
            ${valuesStr}
        ])
    `;

    await bq.query(query);
    console.log('SUCCESS: Plan Data synced to BigQuery.');
}

syncPlan().catch(console.error);
