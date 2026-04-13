import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
    keyFile: 'secrets/crypto-world-epta-2db29829d55d.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SOURCE_IDS = {
    PARTNERSHIP: '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg',
    RENTAL: '1Wzc5hycFJeznkWlh54l5-Wt7d_R9O0_AqExuaytujws'
};

async function getSheetNames() {
    for (const [name, id] of Object.entries(SOURCE_IDS)) {
        try {
            const res = await sheets.spreadsheets.get({ spreadsheetId: id });
            console.log(`${name} sheets:`, res.data.sheets.map(s => s.properties.title));
        } catch (e) {
            console.log(`Error checking ${name}:`, e.message);
        }
    }
}

getSheetNames();
