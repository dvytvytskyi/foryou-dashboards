import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';

const SPREADSHEET_ID = '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg';

export type DepartmentKey = 'partners' | 'realEstate' | 'cb';

export type DepartmentIncome = {
  deals: number;
  income: number;
};

export type MonthlyExpenseRecord = {
  sheetName: string;
  year: number;
  month: number;
  periodKey: string;
  departments: Record<DepartmentKey, DepartmentIncome>;
  expenses: {
    salary: number;
    bases: number;
    accountants: number;
    marketing: number;
    maintenance: number;
    other: number;
    total: number;
  };
};

const MONTHS_MAP: Record<string, number> = {
  ЯНВАРЬ: 1,
  ФЕВРАЛЬ: 2,
  МАРТ: 3,
  АПРЕЛЬ: 4,
  МАЙ: 5,
  ИЮНЬ: 6,
  ИЮЛЬ: 7,
  АВГУСТ: 8,
  СЕНТЯБРЬ: 9,
  ОКТЯБРЬ: 10,
  НОЯБРЬ: 11,
  ДЕКАБРЬ: 12,
};

function toNumber(value: string | number | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const normalized = String(value)
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCell(value: unknown): string {
  return String(value || '').trim();
}

function toDepartmentKey(label: string): DepartmentKey | null {
  const clean = normalizeCell(label);
  const compact = clean.replace(/\s+/g, '');

  if (clean === 'Партнерский отдел') return 'partners';
  if (clean === 'Real Estate') return 'realEstate';
  if (/^[CС][BВ]$/u.test(compact)) return 'cb';

  return null;
}

function parseSheetMonth(title: string): { year: number; month: number } | null {
  const clean = normalizeCell(title).toUpperCase();
  const match = clean.match(/^([А-ЯЁ]+)\s+(\d{2}|\d{4})$/u);
  if (!match) return null;

  const month = MONTHS_MAP[match[1]];
  if (!month) return null;

  const rawYear = Number(match[2]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  return { year, month };
}

function readCredentialsFromEnvOrFile() {
  if (process.env.GOOGLE_SHEETS_KEY_FILE) {
    try {
      return JSON.parse(process.env.GOOGLE_SHEETS_KEY_FILE);
    } catch {
      return null;
    }
  }

  return fs
    .readFile(path.resolve(process.cwd(), 'secrets', 'crypto-world-epta-2db29829d55d.json'), 'utf-8')
    .then((txt) => JSON.parse(txt))
    .catch(() => null);
}

function parseMonthlySheet(sheetName: string, rows: string[][]): MonthlyExpenseRecord | null {
  const dateMeta = parseSheetMonth(sheetName);
  if (!dateMeta) return null;

  const departments: Record<DepartmentKey, DepartmentIncome> = {
    partners: { deals: 0, income: 0 },
    realEstate: { deals: 0, income: 0 },
    cb: { deals: 0, income: 0 },
  };

  let activeDepartment: DepartmentKey | null = null;
  const captured = new Set<DepartmentKey>();

  for (const row of rows) {
    const colA = normalizeCell(row[0]);
    const colB = normalizeCell(row[1]);
    const colC = normalizeCell(row[2]);

    const departmentCandidate = toDepartmentKey(colA);
    if (departmentCandidate && !captured.has(departmentCandidate)) {
      activeDepartment = departmentCandidate;
      continue;
    }

    if (activeDepartment && colA.toUpperCase() === 'ИТОГО') {
      departments[activeDepartment] = {
        deals: toNumber(colB),
        income: toNumber(colC),
      };
      captured.add(activeDepartment);
      activeDepartment = null;

      // Income block has exactly three department totals; stop to avoid later unrelated overrides.
      if (captured.size === 3) break;
    }
  }

  const expenses = {
    salary: 0,
    bases: 0,
    accountants: 0,
    marketing: 0,
    maintenance: 0,
    other: 0,
    total: 0,
  };

  for (const row of rows) {
    const description = normalizeCell(row[4]).toLowerCase();
    const amount = toNumber(row[5]);

    if (!description || amount === 0) continue;
    if (description === 'зарплата') expenses.salary = amount;
    else if (description.includes('базы')) expenses.bases = amount;
    else if (description.includes('бухгалтер')) expenses.accountants = amount;
    else if (description.includes('маркет')) expenses.marketing = amount;
    else if (description.includes('обслуж')) expenses.maintenance = amount;
    else if (description.includes('другое')) expenses.other = amount;
    else if (description === 'итого') expenses.total = amount;
  }

  if (expenses.total === 0) {
    expenses.total =
      expenses.salary + expenses.bases + expenses.accountants + expenses.marketing + expenses.maintenance + expenses.other;
  }

  return {
    sheetName,
    year: dateMeta.year,
    month: dateMeta.month,
    periodKey: `${dateMeta.year}-${String(dateMeta.month).padStart(2, '0')}`,
    departments,
    expenses,
  };
}

export async function readExpensesMonthlyRecords(): Promise<MonthlyExpenseRecord[]> {
  const credentials = await readCredentialsFromEnvOrFile();
  if (!credentials) return [];

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const metadata = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const titles = (metadata.data.sheets || [])
    .map((s) => normalizeCell(s.properties?.title))
    .filter((name) => parseSheetMonth(name) !== null);

  const records: MonthlyExpenseRecord[] = [];
  for (const title of titles) {
    const values = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${title}!A1:L220`,
    });
    const rows = (values.data.values || []) as string[][];
    const parsed = parseMonthlySheet(title, rows);
    if (parsed) records.push(parsed);
  }

  records.sort((a, b) => (a.year - b.year) || (a.month - b.month));
  return records;
}
