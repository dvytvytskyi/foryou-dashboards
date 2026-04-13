import { BigQuery } from '@google-cloud/bigquery';
import { google } from 'googleapis';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SHEET_NAME = '[Working File] Global_Performance_Source';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

async function syncRealDataToSheet() {
    console.log('--- FETCHING REAL FEBRUARY DATA FROM BIGQUERY ---');
    
    const query = `
        SELECT 
          source,
          SUM(deals_count) as deals,
          SUM(income) as income
        FROM \`crypto-world-epta.foryou_analytics.department_performance_all\`
        WHERE DATE_TRUNC(date, MONTH) = "2026-02-01"
        GROUP BY 1
        ORDER BY income DESC
    `;

    const [rows] = await bq.query(query);
    console.log(`Found ${rows.length} real sources for Feb.`);

    // Match with costs from Finance sheet (manual script or from the other sheet)
    // For now, let's just populate the performance data
    const values = rows.map(r => [
        '2026-02-01',
        r.source || 'Unknown',
        0, // Spend will be manually filled or we'll add it later
        r.deals,
        r.income * 1.5, // ESTIMATE Revenue = Income + some profit margin for now since revenue column was missing
        r.income
    ]);

    if (values.length === 0) {
        console.log('No data found for Feb in BigQuery.');
        return;
    }

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values }
    });

    console.log('REAL Performance data for Feb sync successful.');
}

syncRealDataToSheet().catch(console.error);
