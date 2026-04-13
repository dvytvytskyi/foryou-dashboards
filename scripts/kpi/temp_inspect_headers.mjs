import { google } from 'googleapis';
import path from 'path';

const RENT_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SUPPORT_ID = '1-ttYBdON2J_I-6dmdeC6sQb_pgH804RXekxJ0QDOhYw';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});
const sheets = google.sheets({ version: 'v4', auth });

async function inspect() {
    console.log('\nRENT HEADERS (A-P):');
    const rRes = await sheets.spreadsheets.values.get({ spreadsheetId: RENT_ID, range: 'A1:H1' });
    if (rRes.data.values) console.log(rRes.data.values[0].map((v, i) => `[${i}] ${v}`).join(' | '));

    console.log('\nSUPPORT HEADERS (A-P):');
    const sRes = await sheets.spreadsheets.values.get({ spreadsheetId: SUPPORT_ID, range: 'Лист1!A1:H1' });
    if (sRes.data.values) console.log(sRes.data.values[0].map((v, i) => `[${i}] ${v}`).join(' | '));
}

inspect().catch(console.error);
