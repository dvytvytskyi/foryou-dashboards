import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1oyavabblJhtJl2WbeGJoduDUrE6_bG7IXwfd0HCtCuk';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

async function addCopyColumn() {
    console.log('--- ADDING COPY COLUMN TO GENERATOR ---');
    
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Insert empty column before D (Short Tracking Link)
    // Actually just shift and update headers
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEEET_ID,
        range: 'Лист1!A1:G1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [['Campaign Name (Slug)', 'UTM Source', 'UTM Campaign', 'CLICK TO COPY', 'Short Tracking Link (COPY THIS)', 'Preview Status', 'Target WA']]
        }
    });

    // 2. Add Checkboxes to Column D (New Copy Column)
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
                        },
                        rule: {
                            condition: { type: 'BOOLEAN' }
                        }
                    }
                }
            ]
        }
    });

    // 3. Update the ArrayFormula to shift to Column E (New Link Column)
    const arrayFormula = '=ARRAYFORMULA(IF(LEN(A2:A); "https://foryou.ae/go/" & A2:A & "?utm_source=" & B2:B & "&utm_campaign=" & C2:C & "&wa=" & IF(LEN(G2:G); G2:G; "971501769699"); ""))';

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEEET_ID,
        range: 'Лист1!E2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[arrayFormula]]
        }
    });

    console.log('SUCCESS: Copy column with checkboxes and shifted formula added.');
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
            values: [['Campaign Name (Slug)', 'UTM Source', 'UTM Campaign', 'CLICK TO COPY', 'Short Tracking Link (COPY THIS)', 'Preview Status', 'Target WA']]
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
                        },
                        rule: {
                            condition: { type: 'BOOLEAN' }
                        }
                    }
                }
            ]
        }
    });

    const arrayFormula = '=ARRAYFORMULA(IF(LEN(A2:A); "https://foryou.ae/go/" & A2:A & "?utm_source=" & B2:B & "&utm_campaign=" & C2:C & "&wa=" & IF(LEN(G2:G); G2:G; "971501769699"); ""))';

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Лист1!E2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[arrayFormula]]
        }
    });
    console.log('Copy column setup success.');
}

run().catch(console.error);
