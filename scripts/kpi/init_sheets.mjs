import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

async function initKpiSheet() {
    console.log('--- INITIALIZING KPI TARGETS SHEET ---');
    
    // Check if sheet exists
    const ss = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetExists = ss.data.sheets.some(s => s.properties.title === 'KPI_Targets_Source');

    if (!sheetExists) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [{
                    addSheet: { properties: { title: 'KPI_Targets_Source' } }
                }]
            }
        });
        console.log('Sheet created successfully.');
    } else {
        console.log('Sheet already exists.');
    }

    // Prepare Headers
    const headers = [['Month (YYYY-MM-01)', 'Broker Name', 'Target Leads', 'Target Deals', 'Target Revenue', 'CRM Quality (A/B/C)']];
    
    // Write headers
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'KPI_Targets_Source!A1:F1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: headers }
    });

    console.log('Headers initialized.');
}

initKpiSheet().catch(console.error);
