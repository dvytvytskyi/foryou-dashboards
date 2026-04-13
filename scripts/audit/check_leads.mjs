import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
    keyFile: 'secrets/crypto-world-epta-2db29829d55d.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const LEADS_ID = '1Wzc5hycFJeznkWlh54l5-Wt7d_R9O0_AqExuaytujws';

async function checkLeads() {
    const res = await sheets.spreadsheets.get({ spreadsheetId: LEADS_ID });
    console.log('Leads sheets:', res.data.sheets.map(s => s.properties.title));
    
    // Check top rows of likely funnel sheet
    const fRes = await sheets.spreadsheets.values.get({
        spreadsheetId: LEADS_ID,
        range: 'Лист1!A1:Z5',
    });
    console.log('Sample Data:', fRes.data.values);
}

checkLeads();
