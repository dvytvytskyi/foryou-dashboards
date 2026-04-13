import { google } from 'googleapis';
import path from 'path';

const MASTER_SHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const NEW_SHEET_NAME = '[Working File] Global_Performance_Source';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

async function createSheetAndPopulate() {
    console.log('--- CREATING NEW SHEET TAB ---');
    
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: MASTER_SHEET_ID });
    const sheetExists = spreadsheet.data.sheets.some(s => s.properties.title === NEW_SHEET_NAME);

    if (!sheetExists) {
        console.log(`Sheet "${NEW_SHEET_NAME}" not found. Creating...`);
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: MASTER_SHEET_ID,
            requestBody: {
                requests: [{ addSheet: { properties: { title: NEW_SHEET_NAME } } }]
            }
        });
        console.log('Sheet created successfully.');
    } else {
        console.log('Sheet already exists, skipping creation.');
    }
}

createSheetAndPopulate().catch(console.error);
