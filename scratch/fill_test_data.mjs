import { google } from 'googleapis';

const SPREADSHEET_ID = '1HFUfawJrKBcReCn8DYOX-SayhSYvE6IkmYwe1Xjp7e4';
const KEY_FILE = 'secrets/crypto-world-epta-2db29829d55d.json';

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const BROKERS = [
  'Светлана',
  'Daniil Nevzorov',
  'Валерия Богданова',
  'Екатерина Спицына',
  'Камила Евстегнеева',
  'Ирина Кольчугина',
  'Абдуллаев Руслан',
  'Artem Gerasimov',
  'Radik Pogosyan',
  'Диана Рустам Кызы',
  'Динара Исаева',
  'Кристина Нохрина',
  'Dima',
  'Рахимова Гульноза Алишеровна',
  'Tatsiana Hidrevich',
  'Alexey Klykov',
];

// Test data for April 2026
const testData = [
  ['Светлана', 100, 50, 200000, 10],
  ['Daniil Nevzorov', 150, 75, 300000, 15],
  ['Валерия Богданова', 80, 40, 150000, 8],
  ['Екатерина Спицына', 120, 60, 250000, 12],
  ['Камила Евстегнеева', 90, 45, 180000, 9],
  ['Ирина Кольчугина', 110, 55, 220000, 11],
  ['Абдуллаев Руслан', 140, 70, 280000, 14],
  ['Artem Gerasimov', 95, 48, 190000, 9],
  ['Radik Pogosyan', 130, 65, 260000, 13],
  ['Диана Рустам Кызы', 105, 52, 210000, 10],
  ['Динара Исаева', 115, 58, 230000, 11],
  ['Кристина Нохрина', 125, 62, 250000, 12],
  ['Dima', 85, 42, 170000, 8],
  ['Рахимова Гульноза Алишеровна', 135, 67, 270000, 13],
  ['Tatsiana Hidrevich', 100, 50, 200000, 10],
  ['Alexey Klykov', 60, 30, 120000, 6],
];

async function fillTestData() {
  try {
    const sheetName = 'Апрель 26';
    
    // Prepare range and values
    const range = `${sheetName}!A2:E17`; // A2:E17 (16 brokers + header already in row 1)
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'RAW',
      requestBody: {
        values: testData,
      },
    });

    console.log(`✓ Test data filled in ${sheetName}`);
    console.log('Brokers:', testData.map((row) => row[0]).join(', '));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

fillTestData();
