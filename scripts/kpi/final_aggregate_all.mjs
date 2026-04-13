import { google } from 'googleapis';
import path from 'path';

const MASTER_SHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const MASTER_RANGE = '[Working File] Global_Performance_Source!A2:F200';
const FINANCE_ID = '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg';
const LISTING_ID = '1msV2WTD7QwBaOuX2EySRm7a9M8g5pxL7xtk4AHsRDEA';
const SECONDARY_ID = '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE';

const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

async function fullAggregateFix() {
    console.log('--- REBUILDING MASTER SHEET (FIXING SPEND COLUMNS) ---');
    
    // 1. Get Marketing Spends from Finance (I and J columns)
    const finRes = await sheets.spreadsheets.values.get({ 
        spreadsheetId: FINANCE_ID, 
        range: 'ФЕВРАЛЬ 26!I27:J31' // Strictly targeting Source Name and AED columns
    });
    const finRows = finRes.data.values || [];
    const spendMap = {};
    finRows.forEach(r => {
        if (r[0] && r[1]) {
            const rawName = r[0].toString().trim();
            let cleanName = rawName;
            if (rawName.includes('RED')) cleanName = 'RED';
            else if (rawName.includes('Facebook')) cleanName = 'Facebook';
            else if (rawName.includes('Сайт')) cleanName = 'Сайт';
            else if (rawName.includes('СММ')) cleanName = 'SMM';
            
            spendMap[cleanName] = (spendMap[cleanName] || 0) + (parseFloat(r[1].replace(/[^0-9.]/g, '')) || 0);
        }
    });

    const perfMap = {};
    // Initialize with all marketing spend sources
    Object.keys(spendMap).forEach(s => {
        perfMap[s] = { income: 0, deals: 0, spend: spendMap[s] };
    });

    const addData = (source, income, dateStr) => {
        if (!source || source === '#N/A' || !income) return;
        const str = (dateStr || '').toString();
        const isFeb = str.includes('.02.26') || str.includes('.02.2026') || str.includes('02/26') || str.includes('02/2026');
        if (!isFeb) return; 

        let cleanSource = source.toString().trim();
        if (cleanSource.toUpperCase().includes('RED')) cleanSource = 'RED';
        else if (cleanSource.toUpperCase().includes('FACEBOOK')) cleanSource = 'Facebook';
        else if (cleanSource.toUpperCase().includes('САЙТ')) cleanSource = 'Сайт';

        if (!perfMap[cleanSource]) perfMap[cleanSource] = { income: 0, deals: 0, spend: 0 };
        perfMap[cleanSource].income += (parseFloat(income.toString().replace(/[^0-9.]/g, '')) || 0);
        perfMap[cleanSource].deals += 1;
    };

    // 2. Add incomes from Listing and Secondary
    const listRes = await sheets.spreadsheets.values.get({ spreadsheetId: LISTING_ID, range: 'Лист1!A2:P1000' });
    (listRes.data.values || []).forEach(r => addData(r[15], r[14], r[0]));

    const secRes = await sheets.spreadsheets.values.get({ spreadsheetId: SECONDARY_ID, range: 'Real Estate!A2:R1000' });
    (secRes.data.values || []).forEach(r => addData(r[14], r[16], r[1]));

    const finalRows = Object.keys(perfMap).map(source => {
        const d = perfMap[source];
        return ['2026-02-01', source, d.spend, d.deals, d.income * 1.5, d.income];
    });

    await sheets.spreadsheets.values.clear({ spreadsheetId: MASTER_SHEET_ID, range: MASTER_RANGE });
    await sheets.spreadsheets.values.update({
        spreadsheetId: MASTER_SHEET_ID, range: MASTER_RANGE, valueInputOption: 'USER_ENTERED', requestBody: { values: finalRows }
    });

    console.log(`Aggregation finished. Pushed ${finalRows.length} sources.`);
}

fullAggregateFix().catch(console.error);
