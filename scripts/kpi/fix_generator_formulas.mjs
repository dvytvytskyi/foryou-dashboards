import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1oyavabblJhtJl2WbeGJoduDUrE6_bG7IXwfd0HCtCuk';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

async function fixGeneratorFormulas() {
    console.log('--- FIXING FORYOU WA LINK GENERATOR FORMULAS ---');
    
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Using ; as separator for European/Ukrainian locale
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Лист1!D2:D5',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [
                ['=CONCATENATE("https://foryou-kpi.vercel.app/go/"; A2; "?utm_source="; B2; "&utm_campaign="; C2)'],
                ['=CONCATENATE("https://foryou-kpi.vercel.app/go/"; A3; "?utm_source="; B3; "&utm_campaign="; C3)'],
                ['=CONCATENATE("https://foryou-kpi.vercel.app/go/"; A4; "?utm_source="; B4; "&utm_campaign="; C4)'],
                ['=CONCATENATE("https://foryou-kpi.vercel.app/go/"; A5; "?utm_source="; B5; "&utm_campaign="; C5)']
            ]
        }
    });

    console.log('SUCCESS: Formulas fixed with semicolons.');
}

fixGeneratorFormulas().catch(console.error);
