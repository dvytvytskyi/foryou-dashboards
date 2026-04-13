import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
    keyFile: 'secrets/crypto-world-epta-2db29829d55d.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const CORE_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';

async function countFunnelRows() {
    const res = await sheets.spreadsheets.get({
        spreadsheetId: CORE_ID,
        ranges: ['Funnel_History!A:A'],
        includeGridData: false,
    });
    // This is a bit indirect, but we can just fetch the values count
    const res2 = await sheets.spreadsheets.values.get({
        spreadsheetId: CORE_ID,
        range: 'Funnel_History!A:A',
    });
    console.log('Funnel_History Rows:', res2.data.values.length);
}

countFunnelRows();
