
import { google } from 'googleapis';
import path from 'path';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const TARGET_SHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';

async function checkMonths() {
    const res = await sheets.spreadsheets.values.get({ 
        spreadsheetId: TARGET_SHEET_ID, 
        range: 'Global_Master_Feed!A2:B' 
    });
    const rows = res.data.values || [];
    const months = {};
    rows.forEach(r => {
        const month = (r[1] || '').substring(0, 7);
        if (month) months[month] = (months[month] || 0) + 1;
    });
    console.log(JSON.stringify(months, null, 2));
}

checkMonths().catch(console.error);
