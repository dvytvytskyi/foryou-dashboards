import { google } from 'googleapis';
import path from 'path';

const SPREADSHEEET_ID = '1mPEF4-3vOn9Kq60IITQpKvfN0hZqX_uI6o7F8cofB6Q';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

async function inspectSheet() {
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    try {
        const metadata = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEEET_ID
        });
        
        console.log('--- SHEET METADATA ---');
        metadata.data.sheets.forEach(s => {
            console.log(`Tab: "${s.properties.title}" (ID: ${s.properties.sheetId})`);
        });

        const summaryTab = 'Leads_main';
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEEET_ID,
            range: `${summaryTab}!A1:Z10`
        });

        const rows = res.data.values;
        if (rows && rows.length > 0) {
            console.log('\n--- HEADERS ---');
            rows[0].forEach((col, i) => console.log(`${i}: ${col}`));
            
            console.log('\n--- SAMPLE DATA (ROW 2) ---');
            rows[1].forEach((val, i) => console.log(`${i}: ${val}`));
        }

    } catch (error) {
        console.error('Error reading sheet:', error.message);
    }
}

inspectSheet();
