import { google } from 'googleapis';
import path from 'path';

const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const spreadsheetId = '1bgnIYA00G70UQJZX3aoSF0-kdra1kceU';

async function testRead() {
    const auth = new google.auth.GoogleAuth({
        keyFile: BQ_KEY_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'PFKRIS!A1:B10',
        });
        console.log('Values:', res.data.values);
    } catch (e) {
        console.error('FAILED TO READ VALUES:', e.message);
    }
}

testRead().catch(console.error);
