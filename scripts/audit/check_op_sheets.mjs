import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
    keyFile: 'secrets/crypto-world-epta-2db29829d55d.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const OP_ID = '1vbxQZS2HA6QmgR6Wnl86LLdR_-96VV-gKoX2NX99Zpk';

async function checkOpSheets() {
    const res = await sheets.spreadsheets.get({ spreadsheetId: OP_ID });
    console.log('Sheets in OP Registry:', res.data.sheets.map(s => s.properties.title));
}

checkOpSheets();
