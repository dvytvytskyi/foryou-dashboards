import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1oyavabblJhtJl2WbeGJoduDUrE6_bG7IXwfd0HCtCuk';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

async function revertToClean() {
    console.log('--- REVERTING TO CLEAN GENERATOR SHEET ---');
    
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Reset Headers
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEEET_ID,
        range: 'Лист1!A1:G1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [['Campaign Name (Slug)', 'UTM Source', 'UTM Campaign', 'Short Tracking Link (COPY THIS)', 'Preview Status', 'Target WA', '']]
        }
    });

    // 2. Remove Checkboxes (Clear Validation)
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEEET_ID,
        requestBody: {
            requests: [
                {
                    setDataValidation: {
                        range: {
                            sheetId: 0,
                            startRowIndex: 1,
                            endRowIndex: 500,
                            startColumnIndex: 3,
                            endColumnIndex: 4
                        }
                    }
                }
            ]
        }
    });

    // 3. Clear Column D to make room for ArrayFormula
    await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEEET_ID,
        range: 'Лист1!D2:D500'
    });

    // 4. Update the ArrayFormula back to Column D
    const arrayFormula = '=ARRAYFORMULA(IF(LEN(A2:A); "https://foryou.ae/go/" & A2:A & "?utm_source=" & B2:B & "&utm_campaign=" & C2:C & "&wa=" & IF(LEN(F2:F); F2:F; "971501769699"); ""))';

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEEET_ID,
        range: 'Лист1!D2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[arrayFormula]]
        }
    });

    console.log('SUCCESS: Reverted to clean state.');
}

async function run() {
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Лист1!A1:G1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [['Campaign Name (Slug)', 'UTM Source', 'UTM Campaign', 'Short Tracking Link (COPY THIS)', 'Preview Status', 'Target WA', '']]
        }
    });

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            requests: [
                {
                    setDataValidation: {
                        range: {
                            sheetId: 0,
                            startRowIndex: 1,
                            endRowIndex: 500,
                            startColumnIndex: 3,
                            endColumnIndex: 4
                        }
                    }
                }
            ]
        }
    });

    await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Лист1!D2:D500'
    });

    const arrayFormula = '=ARRAYFORMULA(IF(LEN(A2:A); "https://foryou.ae/go/" & A2:A & "?utm_source=" & B2:B & "&utm_campaign=" & C2:C & "&wa=" & IF(LEN(F2:F); F2:F; "971501769699"); ""))';

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Лист1!D2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[arrayFormula]]
        }
    });
    console.log('Revert success.');
}

run().catch(console.error);
