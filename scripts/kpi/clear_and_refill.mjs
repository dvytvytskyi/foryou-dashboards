import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1oyavabblJhtJl2WbeGJoduDUrE6_bG7IXwfd0HCtCuk';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

async function clearAndRefill() {
    console.log('--- CLEANING AND REFILLING GENERATOR ---');
    
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Clear old manual data in column D that blocks ArrayFormula
    await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEEET_ID,
        range: 'Лист1!D2:D500'
    });

    const arrayFormula = '=ARRAYFORMULA(IF(LEN(A2:A); "https://foryou.ae/go/" & A2:A & "?utm_source=" & B2:B & "&utm_campaign=" & C2:C; ""))';

    // 2. Put the formula only in D2
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEEET_ID,
        range: 'Лист1!D2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[arrayFormula]]
        }
    });

    console.log('SUCCESS: Column D cleaned and ArrayFormula re-enabled.');
}

async function run() {
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Лист1!D2:D500'
    });

    const arrayFormula = '=ARRAYFORMULA(IF(LEN(A2:A); "https://foryou.ae/go/" & A2:A & "?utm_source=" & B2:B & "&utm_campaign=" & C2:C; ""))';

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Лист1!D2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[arrayFormula]]
        }
    });
    console.log('Clean and refill success.');
}

run().catch(console.error);
