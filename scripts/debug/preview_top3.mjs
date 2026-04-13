import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
    keyFile: 'secrets/crypto-world-epta-2db29829d55d.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const TARGET_SHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';

async function previewTop3() {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: TARGET_SHEET_ID,
        range: 'Global_Master_Feed!A1:J1000',
    });
    
    const rows = res.data.values;
    const headers = rows[0];
    const data = rows.slice(1);
    
    // Sort by Income (Column 8 / Index 7)
    const sorted = data.sort((a, b) => parseFloat(b[7]) - parseFloat(a[7]));
    
    console.log('--- 🏆 HALL OF FAME PREVIEW (TOP 3) ---');
    sorted.slice(0, 3).forEach((r, i) => {
        console.log(`${i+1}. ${r[4]} | ${r[9]} | Income: ${r[7]} AED`);
    });
}

previewTop3();
