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

async function syncFix() {
    console.log('--- FINAL FIX: SYNCING WITH SOURCE COLUMN ---');
    const parseValue = (v) => {
        let s = (v || '').toString().trim().replace(/AED/gi, '').replace(/\s/g, '').replace(',', '.');
        const parts = s.split('.');
        if (parts.length > 2) { const dec = parts.pop(); s = parts.join('') + '.' + dec; }
        return parseFloat(s) || 0;
    };

    const allDeals = [];
    const getMonthYear = (d) => {
        const s = (d || '').toString();
        if (s.includes('.01.26') || s.includes('.01.2026') || s.includes('.1.2026') || s.includes('.1.26')) return '2026-01-01';
        if (s.includes('.02.26') || s.includes('.02.2026') || s.includes('.2.2026') || s.includes('.2.26')) return '2026-02-01';
        if (s.includes('.03.26') || s.includes('.03.2026') || s.includes('.3.2026') || s.includes('.3.26')) return '2026-03-01';
        return null;
    };

    const listRes = await sheets.spreadsheets.values.get({ spreadsheetId: LISTING_ID, range: 'Лист1!A2:P2000' });
    (listRes.data.values || []).forEach(r => {
        const m = getMonthYear(r[0]);
        if (!r[5] || r[1]?.includes('ИТОГО') || !m) return;
        // r[1] is Project, r[2] is REAL BROKER
        allDeals.push({ date: m, department: 'Первичка', broker: r[2], client: (r[1] || 'Unknown'), source: r[15] || 'Listing', price: parseValue(r[5]), gross: parseValue(r[7]), net: parseValue(r[14]) });
    });

    const secRes = await sheets.spreadsheets.values.get({ spreadsheetId: SECONDARY_ID, range: 'Real Estate!A2:R2000' });
    (secRes.data.values || []).forEach(r => {
        const m = getMonthYear(r[1]);
        if (!r[6] || r[2]?.includes('ИТОГО') || !m) return;
        // r[2] is Department, r[4] is REAL BROKER, r[3] is Client
        allDeals.push({ date: m, department: 'Вторичка', broker: r[4], client: r[3] || 'Unknown', source: 'Secondary', price: parseValue(r[6]), gross: parseValue(r[9]), net: parseValue(r[16]) });
    });

    // 3. Partnership (Add January)
    const partMonths = [
        { name: 'Январь', date: '2026-01-01' },
        { name: 'Февраль', date: '2026-02-01' }, 
        { name: 'Март', date: '2026-03-01' }, 
        { name: 'March', date: '2026-03-01' },
        { name: 'January', date: '2026-01-01' }
    ];
    for (const mObj of partMonths) {
        try {
            const partRes = await sheets.spreadsheets.values.get({ spreadsheetId: PARTNERSHIP_ID, range: `${mObj.name}!A7:E500` });
            (partRes.data.values || []).forEach(r => {
                // Skips headers and total rows
                if (!r[2] || r[0]?.toUpperCase().includes('ИТОГО') || !r[0] || r[0]?.includes('Брокер')) return;
                allDeals.push({ date: mObj.date, department: 'Партнерка', broker: r[0], client: r[1] || 'Partner Client', source: 'External', price: parseValue(r[2]), gross: parseValue(r[3]), net: parseValue(r[4]) });
            });
        } catch (e) {}
    }

    // 4. Rent
    const masterRes = await sheets.spreadsheets.values.get({ spreadsheetId: '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY', range: 'A2:P2000' });
    (masterRes.data.values || []).forEach(r => {
        const m = getMonthYear(r[0]);
        if (r[2] === 'Аренда' && m) {
            allDeals.push({ date: m, department: 'Аренда', broker: r[1], client: r[3] || 'Rent Client', source: 'Master', price: parseValue(r[15]), gross: parseValue(r[15]), net: parseValue(r[15]) });
        }
    });

    // 5. Support
    const supportRes = await sheets.spreadsheets.values.get({ spreadsheetId: '1-ttYBdON2J_I-6dmdeC6sQb_pgH804RXekxJ0QDOhYw', range: 'Лист1!A2:R2500' });
    (supportRes.data.values || []).forEach(r => {
        const m = getMonthYear(r[0]);
        // r[5] is the human employee name
        if (m && !r[1]?.includes('ИТОГО') && r[13]) {
            allDeals.push({ date: m, department: 'Сопровождение', broker: r[5], client: r[4] || 'Support Client', source: 'Support', price: parseValue(r[13]), gross: parseValue(r[13]), net: parseValue(r[13]) });
        }
    });

    const valuesStr = allDeals.map(d => `(DATE '${d.date}', '${d.department}', '${(d.broker || "Agent").replace(/'/g, "")}', '${(d.client || "").replace(/'/g, "")}', '${(d.source || "Unknown").replace(/'/g, "")}', ${d.price}, ${d.gross}, ${d.net}, 0)`).join(',\n');
    
    const query = `
        CREATE OR REPLACE TABLE \`crypto-world-epta.foryou_analytics.deals_performance_detailed\` AS
        SELECT * FROM UNNEST([
            STRUCT<date DATE, department STRING, broker_name STRING, client_name STRING, source STRING, price FLOAT64, gross FLOAT64, net FLOAT64, spend FLOAT64>
            ${valuesStr}
        ])
    `;
    await bq.query(query);
    console.log('SUCCESS: Deals synced with HUMAN Broker Names.');
}

syncFix().catch(console.error);
