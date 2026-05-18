
import { google } from 'googleapis';
import path from 'path';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const BUHG_HISTORY_ID = '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE';

function parseDate(str) {
    if (!str) return null;
    let clean = str.toString().split(' ')[0].trim().replace(/['"`]/g, '');
    const parts = clean.split(/[./-]/);
    if (parts.length >= 2) {
        let p1 = parts[0].padStart(2, '0');
        let p2 = parts[1].padStart(2, '0');
        let y = parts[2] || '2026';
        if (y.length === 2) y = '20' + y;
        let day = p1, month = p2;
        if (parseInt(p1) > 12) { day = p1; month = p2; }
        if (parseInt(month) > 12) { [day, month] = [month, day]; }
        return `${y}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
    }
    return null;
}

async function findMayDeals() {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: BUHG_HISTORY_ID,
        range: 'Real Estate!A2:Z500'
    });
    const rows = res.data.values || [];
    const mayDeals = [];

    rows.forEach((r, index) => {
        const date = parseDate(r[1]);
        if (date && date.startsWith('2026-05')) {
            mayDeals.push({
                row: index + 2,
                date: r[1],
                parsedDate: date,
                category: r[2],
                client: r[3],
                broker: r[4],
                income: r[16],
                source: 'BUHG_HISTORY'
            });
        }
    });

    console.log(JSON.stringify(mayDeals, null, 2));
}

findMayDeals().catch(console.error);
