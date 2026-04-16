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

function buildMonthTitles(startYear = 2026, startMonthIndex = 3, count = 12) {
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(Date.UTC(startYear, startMonthIndex + offset, 1));
    const monthTitle = MONTH_NAMES[date.getUTCMonth()];
    const yearShort = String(date.getUTCFullYear()).slice(-2);
    return `${monthTitle} ${yearShort}`;
  });
}

async function cleanupOldColumns() {
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const allSheets = spreadsheet.data.sheets || [];
    
    const monthTitles = buildMonthTitles();
    
    for (const monthTitle of monthTitles) {
      const sheet = allSheets.find((s) => s.properties?.title === monthTitle);
      if (!sheet) {
        console.log(`Sheet not found: ${monthTitle}`);
        continue;
      }

      const sheetId = sheet.properties.sheetId;
      
      // Delete columns starting from F (index 5) onwards
      // We want to keep columns A-E (5 columns total)
      // So we delete from column index 5 to the end
      
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 5, // Start from column F (6th column, 0-indexed)
                  endIndex: 100, // Delete up to column DV (plenty of buffer)
                },
              },
            },
          ],
        },
      });

      console.log(`Cleaned up old columns in sheet: ${monthTitle}`);
    }

    console.log('Done. Cleaned up all old columns from all 12 sheets.');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

cleanupOldColumns();
