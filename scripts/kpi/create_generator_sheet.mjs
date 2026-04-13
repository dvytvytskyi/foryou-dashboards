import { google } from 'googleapis';
import path from 'path';

const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

async function createLinkGeneratorSheet() {
    console.log('--- CREATING GOOGLE SHEET LINK GENERATOR ---');
    
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    // 1. Create Spreadsheet
    const res = await sheets.spreadsheets.create({
        requestBody: {
            properties: { title: 'FORYOU - WA Link Generator & Tracker' }
        }
    });

    const spreadsheetId = res.data.spreadsheetId;
    const spreadsheetUrl = res.data.spreadsheetUrl;
    console.log(`Sheet Created: ${spreadsheetUrl}`);

    // 2. Setup Headers & Formulas
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1:G2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [
                ['Campaign Name (Slug)', 'UTM Source', 'UTM Campaign', 'WA Number', 'Short Tracking Link (COPY THIS)', 'Preview Text'],
                ['luxury-marina', 'youtube', 'influencer_v1', '971500000000', '=CONCATENATE("https://foryou.ae/go/", A2, "?utm_source=", B2, "&utm_campaign=", C2, "&wa=", D2)', 'Hello! I am interested in Marina promo...']
            ]
        }
    });

    // 3. Share with User (vytvytskyi@gmail.com - usually or broad access)
    // For now, I'll just print ID. User needs to share with themselves if they want access.
    // Or I can try to give "anyone with link" reader access.
    await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: { role: 'reader', type: 'anyone' }
    });

    console.log(`SUCCESS: Link Generator ready at: ${spreadsheetUrl}`);
    return spreadsheetUrl;
}

createLinkGeneratorSheet().catch(console.error);
