import { google } from 'googleapis';

const SPREADSHEET_ID = '1HFUfawJrKBcReCn8DYOX-SayhSYvE6IkmYwe1Xjp7e4';
const KEY_FILE = 'secrets/crypto-world-epta-2db29829d55d.json';

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// New test data with higher values to see the change
const testData = [
  ['Светлана', 500, 250, 1000000, 50],
  ['Daniil Nevzorov', 750, 375, 1500000, 75],
  ['Валерия Богданова', 400, 200, 750000, 40],
  ['Екатерина Спицына', 600, 300, 1250000, 60],
  ['Камила Евстегнеева', 450, 225, 900000, 45],
  ['Ирина Кольчугина', 550, 275, 1100000, 55],
  ['Абдуллаев Руслан', 700, 350, 1400000, 70],
  ['Artem Gerasimov', 475, 240, 950000, 47],
  ['Radik Pogosyan', 650, 325, 1300000, 65],
  ['Диана Рустам Кызы', 525, 260, 1050000, 52],
  ['Динара Исаева', 575, 290, 1150000, 57],
  ['Кристина Нохрина', 625, 310, 1250000, 62],
  ['Dima', 425, 212, 850000, 42],
  ['Рахимова Гульноза Алишеровна', 675, 337, 1350000, 67],
  ['Tatsiana Hidrevich', 500, 250, 1000000, 50],
  ['Alexey Klykov', 300, 150, 600000, 30],
];

async function updateTestData() {
  try {
    const sheetName = 'Апрель 26';
    
    // Prepare range and values
    const range = `${sheetName}!A2:E17`; // A2:E17 (16 brokers)
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'RAW',
      requestBody: {
        values: testData,
      },
    });

    console.log(`✓ Updated test data in ${sheetName}`);
    console.log('Total plan values:');
    let totalLids = 0, totalQl = 0, totalRev = 0, totalDeals = 0;
    for (const row of testData) {
      totalLids += row[1];
      totalQl += row[2];
      totalRev += row[3];
      totalDeals += row[4];
    }
    console.log(`  Лиды: ${totalLids}`);
    console.log(`  QL: ${totalQl}`);
    console.log(`  Выручка: ${totalRev} AED`);
    console.log(`  Сделки: ${totalDeals}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

updateTestData();
