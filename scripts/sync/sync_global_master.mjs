import { google } from 'googleapis';
import path from 'path';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const SOURCE_IDS = {
    OP_REESTR: '1vbxQZS2HA6QmgR6Wnl86LLdR_-96VV-gKoX2NX99Zpk',
    BUHG_HISTORY: '15MRjta9oGobvKIZccnDxcp7jNZmwqvCo3Kr2Q2unfqE',
    SECONDARY: '1msV2WTD7QwBaOuX2EySRm7a9M8g5pxL7xtk4AHsRDEA',
    SUPPORT: '1-ttYBdON2J_I-6dmdeC6sQb_pgH804RXekxJ0QDOhYw',
    PARTNERSHIP: '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg',
    RENTAL: '1Wzc5hycFJeznkWlh54l5-Wt7d_R9O0_AqExuaytujws'
};
const TARGET_SHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';

// Helper to clean numeric strings
const n = (val) => {
    if (!val) return 0;
    // Handle newlines by taking the first line (or sum them if appropriate, but here first is safer)
    const firstLine = val.toString().split(/[\n\r]/)[0].trim();
    return parseFloat(firstLine.replace(/\s/g, '').replace(' ', '').replace(',', '.') || 0);
};

// Robust Date Parsing
function parseDate(str) {
    if (!str || str.toString().toLowerCase().includes('n/a')) return '2026-01-01';
    let clean = str.toString().split(' ')[0].trim().replace(/['"`]/g, '');
    
    // Handle YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return clean.substring(0, 10);

    const parts = clean.split(/[./-]/);
    if (parts.length >= 2) {
        let p1 = parts[0].padStart(2, '0');
        let p2 = parts[1].padStart(2, '0');
        let y = parts[2] || '2026';
        if (y.length === 2) y = '20' + y;
        
        // Assume DD.MM if p1 > 12
        let day = p1, month = p2;
        if (parseInt(p1) > 12) { day = p1; month = p2; }
        
        return `${y}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
    }
    return '2026-01-01';
}

async function syncGlobalMaster() {
    console.log('--- Starting Full Global Master Feed Sync (6 Sources) ---');
    let unified = [];

    // 1. SECONDARY (Date at Col O / index 14)
    const sec = await sheets.spreadsheets.values.get({ spreadsheetId: SOURCE_IDS.SECONDARY, range: 'Лист1!A2:Z' });
    (sec.data.values || []).filter(r => r[13] || r[14]).forEach(r => {
        unified.push({ date: parseDate(r[14]), cat: 'Secondary', broker: r[13] || '', price: n(r[15]), comm: n(r[16]), income: n(r[17]), src: 'SECONDARY', obj: r[1] });
    });

    // 2. OP_REESTR (Primary/Off-Plan) - Date at Col N / index 13
    const op = await sheets.spreadsheets.values.get({ spreadsheetId: SOURCE_IDS.OP_REESTR, range: 'Реестр!A2:Z' });
    (op.data.values || []).filter(r => r[13]).forEach(r => {
        unified.push({ date: parseDate(r[13]), cat: 'Primary', broker: r[8] || '', price: n(r[14]), comm: n(r[15]), income: n(r[16]), src: 'OP_REESTR', obj: r[3] });
    });

    // 3. BUHG HISTORY (Net Income at Col Q / index 16)
    const buhg = await sheets.spreadsheets.values.get({ spreadsheetId: SOURCE_IDS.BUHG_HISTORY, range: 'Real Estate!A2:Z' });
    (buhg.data.values || []).filter(r => r[1]).forEach(r => {
        unified.push({ date: parseDate(r[1]), cat: r[2], client: r[3], broker: r[4], price: n(r[6]), comm: n(r[9]), income: n(r[16]), src: 'BUHG_HISTORY' });
    });

    // 4. SUPPORT (Income at Col N / index 13)
    const sup = await sheets.spreadsheets.values.get({ spreadsheetId: SOURCE_IDS.SUPPORT, range: 'Лист1!A2:Z' });
    (sup.data.values || []).filter(r => r[1] || r[5]).forEach(r => {
        unified.push({ date: parseDate(r[0]), obj: r[1], cat: 'Support', broker: r[5], price: n(r[6]), comm: n(r[7]), income: n(r[13]), src: 'SUPPORT' });
    });

    // 5. PARTNERSHIP (Multiple Monthly Sheets)
    const partMeta = await sheets.spreadsheets.get({ spreadsheetId: SOURCE_IDS.PARTNERSHIP });
    const partSheetNames = partMeta.data.sheets
        .map(s => s.properties.title)
        .filter(t => t.includes('25') || t.includes('26'));
    
    for (const sName of partSheetNames) {
        const pData = await sheets.spreadsheets.values.get({ spreadsheetId: SOURCE_IDS.PARTNERSHIP, range: `${sName}!A2:Z` });
        (pData.data.values || []).filter(r => r[0] && r[0].length > 5).forEach(r => {
            unified.push({ date: parseDate(r[0]), obj: r[1], cat: 'Partnership', broker: r[4], price: n(r[5]), comm: n(r[6]), income: n(r[7]), src: `PARTNERSHIP (${sName})` });
        });
    }

    // 6. RENTAL (Secondary)
    const rent = await sheets.spreadsheets.values.get({ spreadsheetId: SOURCE_IDS.RENTAL, range: 'Лист1!A2:Z' });
    (rent.data.values || []).filter(r => r[0]).forEach(r => {
        unified.push({ date: parseDate(r[0]), obj: r[1], cat: 'Rental', broker: r[3], price: n(r[5]), comm: n(r[6]), income: n(r[7]), src: 'RENTAL' });
    });

    // Deduplication (Date + Price + Broker)
    const unique = [];
    const seen = new Set();
    unified.forEach(d => {
        const key = `${d.date}|${d.price}|${d.broker}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(d);
        }
    });

    console.log(`Deduplicated to ${unique.length} unique deals.`);

    // Build values
    const targetValues = [
        ['Month_Key', 'Дата', 'Год', 'Отдел', 'Категория/Отдел', 'Брокер', 'Стоимость (AED)', 'Комиссия (AED)', 'Доход (AED)', 'Источник данных', 'Объект/Клиент'],
        ...unique.map(d => {
            let dept = 'Other';
            const cat = (d.cat || '').toLowerCase();
            const src = (d.src || '').toLowerCase();
            const broker = (d.broker || '').toLowerCase();
            
            if (src.includes('support') || cat.includes('support') || cat.includes('яна') || cat.includes('кристина') || cat.includes('сопровождение') || broker.includes('яна') || broker.includes('кріс')) {
                dept = 'Support';
            } else if (cat.includes('partnership') || cat.includes('партнер')) {
                dept = 'Partners';
            } else if (cat.includes('cb')) {
                dept = 'CB';
            } else if (src.includes('op_reestr') || cat.includes('первичка') || cat.includes('вторичка') || src.includes('buhg')) {
                dept = 'Sales (OP)';
            }
            return [d.date ? d.date.slice(0, 7) : '', d.date, d.date.split('-')[0], dept, d.cat || '', d.broker || '', d.price, d.comm || 0, d.income, d.src, d.obj || d.client || ''];
        })
    ];

    // CLEAR SHEET FIRST
    console.log('Clearing Global_Master_Feed...');
    await sheets.spreadsheets.values.clear({ spreadsheetId: TARGET_SHEET_ID, range: 'Global_Master_Feed!A1:Z5000' });

    // UPDATE WITH NEW DATA
    await sheets.spreadsheets.values.update({
        spreadsheetId: TARGET_SHEET_ID, range: 'Global_Master_Feed!A1',
        valueInputOption: 'USER_ENTERED', resource: { values: targetValues },
    });
    console.log('--- Global Master Feed Sync Complete ---');
}

syncGlobalMaster().catch(console.error);
