import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
    keyFile: 'secrets/crypto-world-epta-2db29829d55d.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const CORE_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';

async function checkFunnelData() {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: CORE_ID,
        range: 'Funnel_History!A1:Z5',
    });
    console.log('Funnel_History Headers:', res.data.values?.[0]);
    console.log('Sample Row:', res.data.values?.[1]);
    
    try {
        const res2 = await sheets.spreadsheets.values.get({
            spreadsheetId: CORE_ID,
            range: 'Funnel_Milestones!A1:Z5',
        });
        console.log('Funnel_Milestones Headers:', res2.data.values?.[0]);
    } catch (e) {}
}

checkFunnelData();
