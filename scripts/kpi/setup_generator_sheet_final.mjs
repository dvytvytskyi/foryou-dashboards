import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1oyavabblJhtJl2WbeGJoduDUrE6_bG7IXwfd0HCtCuk';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

async function setupGeneratorSheet() {
    console.log('--- SETTING UP FORYOU WA LINK GENERATOR ---');
    
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Initial configuration and headers
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Лист1!A1:G5',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [
                ['Campaign Name (Slug)', 'UTM Source', 'UTM Campaign', 'Short Tracking Link (COPY THIS)', 'Preview Status', 'Target WA'],
                ['luxury-villa-yt', 'youtube', 'vlog_dubai', '=CONCATENATE("https://foryou.ae/go/", A2, "?utm_source=", B2, "&utm_campaign=", C2)', 'READY', '971501769699'],
                ['marina-apt-tg', 'telegram', 'channel_ads', '=CONCATENATE("https://foryou.ae/go/", A3, "?utm_source=", B3, "&utm_campaign=", C3)', 'READY', '971501769699'],
                ['office-rent-pf', 'pf', 'premium_banner', '=CONCATENATE("https://foryou.ae/go/", A4, "?utm_source=", B4, "&utm_campaign=", C4)', 'READY', '971501769699']
            ]
        }
    });

    console.log('SUCCESS: Link Generator table initialized.');
}

setupGeneratorSheet().catch(console.error);
