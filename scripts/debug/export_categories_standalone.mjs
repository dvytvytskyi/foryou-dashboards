import { google } from 'googleapis';
import path from 'path';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
});

const sheets = google.sheets({ version: 'v4', auth });
const drive = google.drive({ version: 'v3', auth });

async function createNewCategorySpreadsheet() {
    console.log('--- Creating NEW Standalone Categories Spreadsheet ---');
    
    // Create new spreadsheet
    const ss = await sheets.spreadsheets.create({
        resource: { properties: { title: 'FORYOU_EXPENSE_CATEGORIES_EXPORT' } }
    });
    const newId = ss.data.spreadsheetId;
    console.log(`New Spreadsheet ID: ${newId}`);

    // Get data from old one
    const oldId = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: oldId, range: 'Global_Expense_Categories!A1:D20' });
    const values = res.data.values || [];

    // Write to new one
    await sheets.spreadsheets.values.update({
        spreadsheetId: newId, range: 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED', resource: { values },
    });

    // Make it accessible (Anyone with link can view for now to ensure Looker sees it)
    await drive.permissions.create({
        fileId: newId,
        resource: { role: 'reader', type: 'anyone' }
    });

    console.log(`Standalone Export URL: https://docs.google.com/spreadsheets/d/${newId}/edit`);
}

createNewCategorySpreadsheet().catch(console.error);
