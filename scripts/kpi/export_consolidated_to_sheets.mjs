import { google } from 'googleapis';
import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: SERVICE_ACCOUNT_FILE
});

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
});

const sheets = google.sheets({ version: 'v4', auth });

async function exportToSheets() {
    console.log('--- EXPORTING CONSOLIDATED DATA FROM BIGQUERY TO GOOGLE SHEETS ---');

    // 1. Fetch from BigQuery
    const query = `
        SELECT 
            date, 
            department, 
            source, 
            price as sum_deal, 
            gross as commission_amount, 
            net as company_income,
            (gross - net) as broker_commission_sum,
            SAFE_DIVIDE(gross - net, gross) as broker_commission_percent
        FROM \`crypto-world-epta.foryou_analytics.deals_performance_detailed\`
        ORDER BY date DESC, department
    `;
    const [rows] = await bq.query(query);

    if (rows.length === 0) {
        console.log('No data found in BigQuery table.');
        return;
    }

    // 2. Prepare Data
    const header = [
        'Дата', 'Подразделение', 'Источник', 'Сумма сделки', 
        'Размер комиссии (брутто)', 'Доход компании (нетто)', 
        'Сума брокеру', '% комиссии брокера'
    ];
    const data = [header, ...rows.map(r => [
        r.date.value || r.date,
        r.department,
        r.source,
        r.sum_deal,
        r.commission_amount,
        r.company_income,
        r.broker_commission_sum,
        (r.broker_commission_percent * 100).toFixed(2) + '%'
    ])];

    // 3. Update Existing Google Sheet
    const spreadsheetId = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
    const sheetName = 'Consolidated_Master_BQ';
    
    try {
        // Try to add the sheet first (it might fail if it already exists, that's fine)
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [{ addSheet: { properties: { title: sheetName } } }]
            }
        });
    } catch (e) {
        // Sheet already exists, ignore error
    }

    // 4. Clear and Write Data
    await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetName}!A1:Z5000`
    });

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: data }
    });

    console.log(`--- ✅ EXPORT COMPLETE: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0 ---`);
}

exportToSheets().catch(console.error);
