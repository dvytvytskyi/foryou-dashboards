import { google } from 'googleapis';

const SPREADSHEET_ID = '1HFUfawJrKBcReCn8DYOX-SayhSYvE6IkmYwe1Xjp7e4';
const KEY_FILE = 'secrets/crypto-world-epta-2db29829d55d.json';

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

function getMonthSheetName(month, year = 2026) {
  // month: 0-11 (0 = January, 3 = April)
  // e.g., getMonthSheetName(3, 2026) => "Апрель 26"
  const monthTitle = MONTH_NAMES[month];
  const yearShort = String(year).slice(-2);
  return `${monthTitle} ${yearShort}`;
}

async function readPlanData(sheetName) {
  try {
    const range = `${sheetName}!A:E`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });

    const data = response.data.values || [];
    const headers = data[0] || [];
    const rows = data.slice(1);

    console.log(`\n📋 Plan Data from "${sheetName}":`);
    console.log('─'.repeat(90));
    console.log(
      'Брокер'.padEnd(30),
      'Лиды'.padEnd(12),
      'QL'.padEnd(12),
      'Выручка'.padEnd(18),
      'Сделки'
    );
    console.log('─'.repeat(90));

    const planByBroker = {};
    rows.forEach((row) => {
      const [broker, lids, ql, revenue, deals] = row;
      if (!broker || !broker.trim()) return;
      
      planByBroker[broker] = {
        lids: parseInt(lids) || 0,
        ql: parseInt(ql) || 0,
        revenue: parseInt(revenue) || 0,
        deals: parseInt(deals) || 0,
      };

      console.log(
        broker.padEnd(30),
        String(lids || 0).padEnd(12),
        String(ql || 0).padEnd(12),
        String(revenue || 0).padEnd(18),
        String(deals || 0)
      );
    });

    console.log('─'.repeat(90));
    return planByBroker;
  } catch (error) {
    console.error('Error reading plan data:', error.message);
    return {};
  }
}

async function test() {
  // Read plan for April 2026
  const aprilSheetName = getMonthSheetName(3, 2026); // April = month 3
  const planData = await readPlanData(aprilSheetName);

  console.log(`\n✓ Loaded plan for ${aprilSheetName}:`, Object.keys(planData).length, 'brokers');
}

test();
