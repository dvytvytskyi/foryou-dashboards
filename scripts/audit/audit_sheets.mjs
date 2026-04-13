
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

const spreadsheetIds = [
    '1Wzc5hycFJeznkWlh54l5-Wt7d_R9O0_AqExuaytujws',
    '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg',
    '1vbxQZS2HA6QmgR6Wnl86LLdR_-96VV-gKoX2NX99Zpk',
    '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE',
    '1msV2WTD7QwBaOuX2EySRm7a9M8g5pxL7xtk4AHsRDEA',
    '1-ttYBdON2J_I-6dmdeC6sQb_pgH804RXekxJ0QDOhYw'
];

async function auditSheets() {
    for (const spreadsheetId of spreadsheetIds) {
        try {
            const meta = await sheets.spreadsheets.get({ spreadsheetId });
            console.log(`\n\x1b[36m--- ${meta.data.properties.title} (${spreadsheetId}) ---\x1b[0m`);
            
            for (const sheet of meta.data.sheets) {
                const title = sheet.properties.title;
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: `${title}!1:1`, // Get header row
                });
                
                const headers = response.data.values ? response.data.values[0] : [];
                console.log(`  [Sheet: ${title}]`);
                console.log(`  Headers: ${headers.join(' | ').slice(0, 150)}...`);
            }
        } catch (err) {
            console.error(`  Error reading ${spreadsheetId}: ${err.message}`);
        }
    }
}

auditSheets();
