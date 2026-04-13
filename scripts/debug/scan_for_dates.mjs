import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
    keyFile: 'secrets/crypto-world-epta-2db29829d55d.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const BUHG_ID = '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE';

async function scanForDates() {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: BUHG_ID, range: 'Расходы!A1:Z100' });
    const rows = res.data.values || [];
    
    console.log('--- SEARCHING FOR DATES/HEADERS ---');
    rows.forEach((r, i) => {
        const text = r.join(' ');
        if (text.match(/\d{2}\.\d{2}/) || text.match(/202/)) {
            console.log(`Potential Date at Row ${i}:`, r);
        }
    });
    
    // Check first column 
    console.log('First 10 rows first col:', rows.slice(0, 10).map(r => r[0]));
}

scanForDates();
