import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1oyavabblJhtJl2WbeGJoduDUrE6_bG7IXwfd0HCtCuk';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

async function fixArrayFormulaWithWA() {
    console.log('--- ADDING WA NUMBER TO ARRAYFORMULA ---');
    
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Include &wa= part from column F
    // Added fallback: if F is empty, use default 971501769699
    const arrayFormula = '=ARRAYFORMULA(IF(LEN(A2:A); "https://foryou.ae/go/" & A2:A & "?utm_source=" & B2:B & "&utm_campaign=" & C2:C & "&wa=" & IF(LEN(F2:F); F2:F; "971501769699"); ""))';

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEEET_ID,
        range: 'Лист1!D2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[arrayFormula]]
        }
    });

    console.log('SUCCESS: ArrayFormula updated with WA number support.');
}

async function run() {
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const arrayFormula = '=ARRAYFORMULA(IF(LEN(A2:A); "https://foryou.ae/go/" & A2:A & "?utm_source=" & B2:B & "&utm_campaign=" & C2:C & "&wa=" & IF(LEN(F2:F); F2:F; "971501769699"); ""))';

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Лист1!D2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[arrayFormula]]
        }
    });
    console.log('ArrayFormula WA fix success.');
}

run().catch(console.error);
