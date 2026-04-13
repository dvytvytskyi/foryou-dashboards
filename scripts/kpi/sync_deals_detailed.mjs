import { google } from 'googleapis';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const PARTNERSHIP_ID = '1vbxQZS2HA6QmgR6Wnl86LLdR_-96VV-gKoX2NX99Zpk';
const SECONDARY_ID = '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE';
const LISTING_ID = '1msV2WTD7QwBaOuX2EySRm7a9M8g5pxL7xtk4AHsRDEA';

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

async function syncViaSQL() {
    console.log('--- SYNCING DEALS VIA SQL (ATOMIC) ---');
    const parseValue = (v) => {
        let s = (v || '').toString().trim().replace(/AED/gi, '').replace(/\s/g, '').replace(',', '.');
        const parts = s.split('.');
        if (parts.length > 2) { const dec = parts.pop(); s = parts.join('') + '.' + dec; }
        return parseFloat(s) || 0;
    };

    const allDeals = [];
    const getMonthYear = (d) => {
        const s = (d || '').toString();
        if (s.includes('.02.26') || s.includes('.02.2026') || s.includes('.2.2026') || s.includes('.2.26')) return '2026-02-01';
        if (s.includes('.03.26') || s.includes('.03.2026') || s.includes('.3.2026') || s.includes('.3.26')) return '2026-03-01';
        return null;
    };

    const listRes = await sheets.spreadsheets.values.get({ spreadsheetId: LISTING_ID, range: 'Лист1!A2:P1000' });
    (listRes.data.values || []).forEach(r => {
        const m = getMonthYear(r[0]);
        if (!r[5] || r[1]?.includes('ИТОГО') || !m) return;
        allDeals.push({ date: m, department: 'Первичка', price: parseValue(r[5]), gross: parseValue(r[7]), net: parseValue(r[14]) });
    });

    const secRes = await sheets.spreadsheets.values.get({ spreadsheetId: SECONDARY_ID, range: 'Real Estate!A2:R1000' });
    (secRes.data.values || []).forEach(r => {
        const m = getMonthYear(r[1]);
        if (!r[6] || r[2]?.includes('ИТОГО') || !m) return;
        allDeals.push({ date: m, department: 'Вторичка', price: parseValue(r[6]), gross: parseValue(r[9]), net: parseValue(r[16]) });
    });

    const partRes = await sheets.spreadsheets.values.get({ spreadsheetId: PARTNERSHIP_ID, range: 'Февраль!A7:E500' });
    (partRes.data.values || []).forEach(r => {
        if (!r[2] || r[0]?.toUpperCase().includes('ИТОГО')) return;
        allDeals.push({ date: '2026-02-01', department: 'Партнерка', price: parseValue(r[2]), gross: parseValue(r[3]), net: parseValue(r[4]) });
    });

    if (allDeals.length === 0) return console.log('No deals found.');

    const valuesStr = allDeals.map(d => `(DATE '${d.date}', '${d.department}', ${d.price}, ${d.gross}, ${d.net})`).join(',\n');
    
    const query = `
        CREATE OR REPLACE TABLE \`crypto-world-epta.foryou_analytics.deals_performance_detailed\` AS
        SELECT * FROM UNNEST([
            STRUCT<date DATE, department STRING, price FLOAT64, gross FLOAT64, net FLOAT64>
            ${valuesStr}
        ])
    `;

    await bq.query(query);
    console.log(`SUCCESS: Atomic SQL update for ${allDeals.length} deals.`);
    
    const [rows] = await bq.query(`SELECT department, COUNT(*) as deals, AVG(price) as avg_price, AVG(net) as avg_income FROM \`crypto-world-epta.foryou_analytics.deals_performance_detailed\` GROUP BY department`);
    console.table(rows);
}

syncViaSQL().catch(console.error);
