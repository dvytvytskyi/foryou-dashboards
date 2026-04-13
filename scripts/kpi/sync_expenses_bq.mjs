import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const SPREADSHEET_ID = '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'expenses_core_v2';
const LOCATION = 'europe-central2';

const bq = new BigQuery({ projectId: 'crypto-world-epta', keyFilename: BQ_KEY_FILE, location: LOCATION });
const auth = new google.auth.GoogleAuth({
    keyFile: BQ_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

async function syncAllExpenses() {
    console.log('--- STARTING SMART CATEGORY SYNC (BLOCK PARSER) ---');
    const sheets = google.sheets({ version: 'v4', auth });
    
    const targets = [
        { name: 'ФЕВРАЛЬ 26', date: '2026-02-01' },
        { name: 'ЯНВАРЬ 26', date: '2026-01-01' }
    ];
    
    const allEntries = [];
    const parseValue = (v) => {
        if (!v) return 0;
        return parseFloat(v.toString().replace(/\s/g, '').replace(',', '.')) || 0;
    };

    for (const t of targets) {
        console.log(`Processing ${t.name}...`);
        const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${t.name}!I1:J500` });
        const rows = res.data.values || [];
        
        let currentCategory = 'Other';
        
        for (const r of rows) {
            const name = r[0];
            const amountStr = r[1];
            
            if (!name || name === 'Детализация расход' || name === 'ФИО') continue;
            
            const amount = parseValue(amountStr);
            
            // Logic: If there's a name but NO amount, and it's not 'ИТОГО', it's a category header
            if (name && !amountStr && !name.includes('ИТОГО')) {
                currentCategory = name.trim();
                console.log(`New Category Found: ${currentCategory}`);
                continue;
            }
            
            // If there's an amount, it's an expense line item
            if (amount > 0 && !name.includes('ИТОГО')) {
                allEntries.push({
                    date: t.date,
                    item_name: name.trim(),
                    amount: amount,
                    category: currentCategory
                });
            }
        }
    }

    console.log(`Total details found: ${allEntries.length}`);
    const jsonRows = allEntries.map(row => JSON.stringify(row)).join('\n');
    const tempFile = path.resolve('/tmp/expenses_v_smart.json');
    fs.writeFileSync(tempFile, jsonRows);

    const schema = {
        fields: [
            { name: 'date', type: 'DATE' },
            { name: 'item_name', type: 'STRING' },
            { name: 'amount', type: 'FLOAT64' },
            { name: 'category', type: 'STRING' }
        ]
    };

    console.log('Pushing to BigQuery...');
    const [job] = await bq.dataset(DATASET_ID).table(TABLE_ID).load(tempFile, {
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        writeDisposition: 'WRITE_TRUNCATE',
        schema: schema,
        location: LOCATION
    });

    const jobId = job.id.split('.').pop();
    while (true) {
        const [meta] = await bq.job(jobId, { location: LOCATION }).getMetadata();
        if (meta.status.state === 'DONE') break;
        await new Promise(r => setTimeout(r, 1000));
    }

    // Refresh the view
    await bq.query(`CREATE OR REPLACE VIEW \`crypto-world-epta.${DATASET_ID}.ГОТОВЫЙ_МАСТЕР_РАСХОДОВ\` AS SELECT * FROM \`crypto-world-epta.${DATASET_ID}.${TABLE_ID}\``, { location: LOCATION });
    
    console.log('--- ALL DONE WITH SMART CATEGORIES ---');
}

syncAllExpenses().catch(console.error);
