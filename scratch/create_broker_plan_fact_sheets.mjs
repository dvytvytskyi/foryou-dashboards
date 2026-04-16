import { google } from 'googleapis';

const SPREADSHEET_ID = '1HFUfawJrKBcReCn8DYOX-SayhSYvE6IkmYwe1Xjp7e4';
const KEY_FILE = 'secrets/crypto-world-epta-2db29829d55d.json';

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

const HEADERS = [
  'Брокер',
  'Лиды (План)',
  'QL Leads (План)',
  'Выручка (План)',
  'Сделки (План)',
];

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

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

function buildMonthTitles(startYear = 2026, startMonthIndex = 3, count = 12) {
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(Date.UTC(startYear, startMonthIndex + offset, 1));
    const monthTitle = MONTH_NAMES[date.getUTCMonth()];
    const yearShort = String(date.getUTCFullYear()).slice(-2);
    return `${monthTitle} ${yearShort}`;
  });
}

function buildRows() {
  return BROKERS.map((broker) => [
    broker,
    '',
    '',
    '',
    '',
  ]);
}

function materializeRows() {
  return buildRows();
}

async function deleteDefaultSheetIfPresent(sheetsMeta) {
  const defaultSheet = sheetsMeta.find((sheet) => sheet.properties?.title === 'Аркуш1' || sheet.properties?.title === 'Sheet1');
  if (typeof defaultSheet?.properties?.sheetId !== 'number') return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ deleteSheet: { sheetId: defaultSheet.properties.sheetId } }],
    },
  });
}

async function ensureSheets(monthTitles) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingSheets = spreadsheet.data.sheets || [];
  const existingByName = new Map(existingSheets.map((sheet) => [sheet.properties?.title, sheet.properties]));

  const addRequests = monthTitles
    .filter((title) => !existingByName.has(title))
    .map((title) => ({
      addSheet: {
        properties: {
          title,
          gridProperties: {
            rowCount: 200,
            columnCount: HEADERS.length,
            frozenRowCount: 1,
            frozenColumnCount: 1,
          },
        },
      },
    }));

  if (addRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: addRequests },
    });
  }

  const refreshed = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  return refreshed.data.sheets || [];
}

async function writeSheet(title, sheetId) {
  const rows = materializeRows();
  const lastColumn = String.fromCharCode(64 + HEADERS.length);
  const range = `${title}!A1:${lastColumn}${rows.length + 1}`;

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${title}!A:${lastColumn}`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [HEADERS, ...rows],
    },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.12, green: 0.14, blue: 0.18 },
                horizontalAlignment: 'CENTER',
                textFormat: {
                  bold: true,
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                  fontSize: 10,
                },
                wrapStrategy: 'WRAP',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,wrapStrategy)',
          },
        },
        {
          setBasicFilter: {
            filter: {
              range: {
                sheetId,
                startRowIndex: 0,
                endRowIndex: rows.length + 1,
                startColumnIndex: 0,
                endColumnIndex: HEADERS.length,
              },
            },
          },
        },
        {
          updateDimensionProperties: {
            range: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: HEADERS.length,
            },
            properties: {
              pixelSize: 160,
            },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 1,
            },
            properties: {
              pixelSize: 240,
            },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex: 1,
              endIndex: 2,
            },
            properties: {
              pixelSize: 120,
            },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex: HEADERS.length - 1,
              endIndex: HEADERS.length,
            },
            properties: {
              pixelSize: 260,
            },
            fields: 'pixelSize',
          },
        },
      ],
    },
  });
}

async function main() {
  const monthTitles = buildMonthTitles();
  const sheetsMeta = await ensureSheets(monthTitles);
  await deleteDefaultSheetIfPresent(sheetsMeta);
  const refreshedSheets = (await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })).data.sheets || [];
  const sheetByTitle = new Map(refreshedSheets.map((sheet) => [sheet.properties?.title, sheet.properties?.sheetId]));

  for (const title of monthTitles) {
    const sheetId = sheetByTitle.get(title);
    if (typeof sheetId !== 'number') {
      throw new Error(`Sheet not found after creation: ${title}`);
    }

    await writeSheet(title, sheetId);
    console.log(`Created/updated sheet: ${title}`);
  }

  console.log(`Done. Prepared ${monthTitles.length} monthly sheets in spreadsheet ${SPREADSHEET_ID}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});