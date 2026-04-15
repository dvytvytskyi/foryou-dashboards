import { google } from 'googleapis';
import path from 'path';
import fs from 'fs/promises';

const SPREADSHEET_ID = '1HFUfawJrKBcReCn8DYOX-SayhSYvE6IkmYwe1Xjp7e4';

// Monthly names for sheet identification
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

export type PlanRow = {
  broker: string;
  lids: number;
  ql: number;
  revenue: number;
  deals: number;
};

export type PlanByBroker = Record<
  string,
  {
    lids: number;
    ql: number;
    revenue: number;
    deals: number;
  }
>;

function getMonthSheetName(month: number, year: number = 2026): string {
  // month: 0-11 (0 = January, 3 = April)
  const monthTitle = MONTH_NAMES[month];
  const yearShort = String(year).slice(-2);
  return `${monthTitle} ${yearShort}`;
}

function getCacheFilePath(month: number, year: number = 2026): string {
  const sheetName = getMonthSheetName(month, year);
  const cleanName = sheetName.replace(/\s+/g, '_');
  return path.resolve(process.cwd(), 'data', 'cache', 'plan-data', `${cleanName}.json`);
}

export async function readPlanDataFromSheets(month: number, year: number = 2026): Promise<PlanByBroker> {
  try {
    // Try to read from cache first
    const cachePath = getCacheFilePath(month, year);
    try {
      const cached = await fs.readFile(cachePath, 'utf-8');
      const parsed = JSON.parse(cached);
      console.log(`✓ Read plan data from cache: "${getMonthSheetName(month, year)}"`);
      return parsed;
    } catch (e) {
      // Cache miss — continue to read from sheets
    }

    // Get service account credentials from environment or file
    let credentials;
    const keyFileContent = process.env.GOOGLE_SHEETS_KEY_FILE;
    if (keyFileContent) {
      try {
        credentials = JSON.parse(keyFileContent);
      } catch {
        console.warn('⚠ Failed to parse GOOGLE_SHEETS_KEY_FILE env var');
        return {};
      }
    } else {
      // Try to read from file
      try {
        const keyFilePath = path.resolve(process.cwd(), 'secrets', 'crypto-world-epta-2db29829d55d.json');
        const keyfileContent = await fs.readFile(keyFilePath, 'utf-8');
        credentials = JSON.parse(keyfileContent);
      } catch {
        console.warn('⚠ Cannot read Google Sheets credentials from env or file. Returning empty plan.');
        return {};
      }
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const sheetName = getMonthSheetName(month, year);

    const range = `${sheetName}!A:E`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const data = response.data.values || [];
    const rows = data.slice(1); // Skip header row

    const planByBroker: PlanByBroker = {};
    rows.forEach((row) => {
      const [broker, lids, ql, revenue, deals] = row;
      if (!broker || !broker.toString().trim()) return;

      planByBroker[broker] = {
        lids: parseInt(lids) || 0,
        ql: parseInt(ql) || 0,
        revenue: parseInt(revenue) || 0,
        deals: parseInt(deals) || 0,
      };
    });

    // Write to cache
    try {
      const cacheDir = path.resolve(process.cwd(), 'data', 'cache', 'plan-data');
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(planByBroker, null, 2));
    } catch (e) {
      console.warn('⚠ Failed to write plan cache');
    }

    console.log(`✓ Read plan data from Google Sheets "${sheetName}": ${Object.keys(planByBroker).length} brokers`);
    return planByBroker;
  } catch (error) {
    console.error('Error reading plan from sheets:', error instanceof Error ? error.message : String(error));
    return {};
  }
}
