import { google } from 'googleapis';
import fs from 'fs';

const auth = new google.auth.GoogleAuth({
    keyFile: 'secrets/crypto-world-epta-2db29829d55d.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SUPPORT_ID = '1-ttYBdON2J_I-6dmdeC6sQb_pgH804RXekxJ0QDOhYw';

async function checkSupport() {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SUPPORT_ID,
        range: 'Лист1!A1:J10',
    });
    console.log('Headers:', res.data.values[0]);
    console.log('Row 2:', res.data.values[1]);
}

checkSupport();
