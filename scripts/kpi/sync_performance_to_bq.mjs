import { google } from 'googleapis';
import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const SPREADSHEEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SHEET_NAME = '[Working File] Global_Performance_Source';
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

async function syncPerformanceSheetToBQ() {
    console.log('--- CREATING NEW DYNAMIC SOURCE (global_performance_master) ---');
    
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEEET_ID,
        range: `${SHEET_NAME}!A2:F200`
    });

    const rows = res.data.values;
    if (!rows || rows.length === 0) return;

    const bqRows = rows.map(r => ({
        date: r[0],
        source: r[1],
        spend: parseFloat(r[2]?.toString().replace(/[^0-9.]/g, '')) || 0,
        deals_count: parseInt(r[3]) || 0,
        revenue: parseFloat(r[4]?.toString().replace(/[^0-9.]/g, '')) || 0,
        income: parseFloat(r[5]?.toString().replace(/[^0-9.]/g, '')) || 0,
        updated_at: new Date().toISOString()
    })).filter(r => r.source && r.date);

    const tableId = 'global_perf_v4';
    const masterId = 'global_performance_master';
    const dataset = bq.dataset('foryou_analytics');
    const table = dataset.table(tableId);

    // 1. Create Sync Table
    try {
        const [exists] = await table.exists();
        if (!exists) {
            await dataset.createTable(tableId, {
                schema: [
                    { name: 'date', type: 'DATE' },
                    { name: 'source', type: 'STRING' },
                    { name: 'spend', type: 'FLOAT' },
                    { name: 'deals_count', type: 'INTEGER' },
                    { name: 'revenue', type: 'FLOAT' },
                    { name: 'income', type: 'FLOAT' },
                    { name: 'updated_at', type: 'TIMESTAMP' }
                ]
            });
        }
    } catch (e) {}

    console.log(`Uploading ${bqRows.length} rows...`);
    await table.insert(bqRows);

    // 2. Create Master View with NEW name
    const viewQuery = `
        CREATE OR REPLACE VIEW \`crypto-world-epta.foryou_analytics.${masterId}\` AS
        SELECT 
          CAST(date AS DATE) as date,
          source,
          income,
          revenue,
          spend,
          deals_count,
          SAFE_DIVIDE(income, NULLIF(spend, 0)) as roi_ratio
        FROM \`crypto-world-epta.foryou_analytics.${tableId}\`
        QUALIFY ROW_NUMBER() OVER(PARTITION BY date, source ORDER BY updated_at DESC) = 1
    `;
    await bq.query(viewQuery);

    console.log(`SUCCESS. Use table "${masterId}" in Looker Studio.`);
}

syncPerformanceSheetToBQ().catch(console.error);
