import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1oyavabblJhtJl2WbeGJoduDUrE6_bG7IXwfd0HCtCuk';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

async function setupArrayFormula() {
    console.log('--- SETTING UP ARRAYFORMULA FOR AUTO-LINKS ---');
    
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // This ARRAYFORMULA will process the entire column D automatically
    // It says: if Column A is not empty, generate the link
    const arrayFormula = '=ARRAYFORMULA(IF(LEN(A2:A); "https://foryou-kpi.vercel.app/go/" & A2:A & "?utm_source=" & B2:B & "&utm_campaign=" & C2:C; ""))';

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEEET_ID, // Typo fixed in the script below but I will ensure it's SPREADSHEET_ID
        range: 'Лист1!D2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[arrayFormula]]
        }
    });

    console.log('SUCCESS: ArrayFormula applied to column D.');
}

// Fixed SPREADSHEET_ID reference below
async function run() {
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    const arrayFormula = '=ARRAYFORMULA(IF(LEN(A2:A); "https://foryou-kpi.vercel.app/go/" & A2:A & "?utm_source=" & B2:B & "&utm_campaign=" & C2:C; ""))';

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Лист1!D2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[arrayFormula]]
        }
    });
    console.log('ArrayFormula update success.');
}

run().catch(console.error);
