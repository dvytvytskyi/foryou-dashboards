import { google } from 'googleapis';
import path from 'path';
import { Client } from 'pg';
import fs from 'fs';

// 1. Configuration
const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');

function getConnectionString() {
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  // Fallback to .env parsing if needed, but in this env POSTGRES_URL is set in .env
  return 'postgresql://neondb_owner:npg_w7n5SCBIMREh@ep-mute-sun-alvioxy1-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require';
}

const n = (val) => {
    if (val === undefined || val === null) return 0;
    const s = val.toString().replace(/\s/g, '').replace(',', '.');
    return parseFloat(s) || 0;
};

async function syncToPostgres() {
    console.log('--- 🚀 Syncing Global_Master_Feed to Postgres ---');

    // 2. Authenticate Google
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // 3. Fetch data from Google Sheets
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Global_Master_Feed!A2:K5000',
    });
    const rows = res.data.values || [];
    console.log(`Fetched ${rows.length} rows from Google Sheets.`);

    // 4. Connect to Postgres
    const client = new Client({
        connectionString: getConnectionString(),
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    try {
        await client.query('BEGIN');
        
        // 5. Clear existing data
        console.log('Clearing sales_deals_raw...');
        await client.query('DELETE FROM sales_deals_raw');

        // 6. Insert new data
        const insertQuery = `
            INSERT INTO sales_deals_raw (
                source_file, row_number, deal_date, deal_type, broker, partner,
                source_label, gmv, gross, net, payload, synced_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW())
        `;

        let insertedCount = 0;
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            let dateStr = r[1];
            if (!dateStr || dateStr === 'Month_Key' || dateStr === 'Дата') continue;

            // Robust date parsing for the sheet data
            let dealDate = null;
            try {
                // Try to parse YYYY-MM-DD
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    const parts = dateStr.split('-');
                    let y = parseInt(parts[0]);
                    let m = parseInt(parts[1]);
                    let d = parseInt(parts[2]);
                    
                    // Fix swapped month/day if they were incorrectly pushed to the sheet
                    if (m > 12 && d <= 12) {
                        [m, d] = [d, m];
                    }
                    
                    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                        dealDate = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                    }
                }
            } catch (e) {
                console.warn(`Skipping row ${i+2} due to invalid date: ${dateStr}`);
                continue;
            }

            if (!dealDate) {
                console.warn(`Skipping row ${i+2} due to unparseable date: ${dateStr}`);
                continue;
            }

            const category = (r[4] || '').toLowerCase();
            let dealType = 'Offplan';
            if (category.includes('secondary') || category.includes('вторичка')) dealType = 'Secondary';
            else if (category.includes('rental') || category.includes('аренда')) dealType = 'Rental';
            else if (category.includes('support') || category.includes('сопровождение')) dealType = 'Support';
            else if (category.includes('primary') || category.includes('первичка')) dealType = 'Offplan';

            const broker = r[5] || '';
            const gmv = n(r[6]);
            const gross = n(r[7]);
            const net = n(r[8]);
            const source = r[9] || 'GoogleSheet';
            const info = r[10] || '';

            await client.query(insertQuery, [
                'GoogleSheets/Global_Master_Feed',
                i + 2,
                dealDate,
                dealType,
                broker,
                info,
                source,
                gmv,
                gross,
                net,
                JSON.stringify({ sheet: 'Global_Master_Feed', originalCategory: r[4], originalDate: dateStr })
            ]);
            insertedCount++;
        }

        await client.query('COMMIT');
        console.log(`Successfully synced ${insertedCount} rows to Postgres.`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during sync:', err);
        throw err;
    } finally {
        await client.end();
    }
}

syncToPostgres().catch(console.error);
