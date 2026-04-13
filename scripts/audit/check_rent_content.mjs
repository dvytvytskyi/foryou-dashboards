import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');

async function check() {
    const spreadsheetId = '1vbxQZS2HA6QmgR6Wnl86LLdR_-96VV-gKoX2NX99Zpk';
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Февраль!A1:Z10',
    });
    console.log(JSON.stringify(res.data.values, null, 2));
}

check().catch(console.error);
