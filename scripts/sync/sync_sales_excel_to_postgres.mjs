import { Client } from 'pg';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { existsSync } from 'fs';

function getConnectionString() {
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;

  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DB;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const sslMode = (process.env.POSTGRES_SSL_MODE || 'require').toLowerCase();

  if (!host || !database || !user || !password) {
    throw new Error('Missing PostgreSQL env. Set POSTGRES_URL or POSTGRES_HOST/PORT/DB/USER/PASSWORD');
  }

  const sslPart = sslMode === 'disable' ? '' : '?sslmode=require';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}${sslPart}`;
}

function parseNumeric(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value && 'result' in value) return Number(value.result || 0);
  if (typeof value === 'string') {
    // Extract only the first number before any operator (+, -, *, /) or non-numeric text
    // e.g. "110000+30000 (TOP UP)" → 110000, "1 500 000" → 1500000, "2%" → 0
    const firstToken = value.trim().match(/^[\d\s,.']*\d/);
    if (!firstToken) return 0;
    const cleaned = firstToken[0].replace(/[\s']/g, '').replace(',', '.');
    return Number(cleaned || 0);
  }
  return 0;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();

    // ISO-like format: YYYY-MM-DD
    const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      const year = parseInt(iso[1], 10);
      const month = parseInt(iso[2], 10);
      const day = parseInt(iso[3], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const dt = new Date(Date.UTC(year, month - 1, day));
        if (!Number.isNaN(dt.getTime())) return dt;
      }
    }

    // Local format: DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY
    const local = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (local) {
      const day = parseInt(local[1], 10);
      const month = parseInt(local[2], 10);
      let year = parseInt(local[3], 10);
      if (year < 100) year += 2000;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const dt = new Date(Date.UTC(year, month - 1, day));
        if (!Number.isNaN(dt.getTime())) return dt;
      }
    }
  }
  return null;
}

/** Parse a single CSV line respecting double-quoted fields */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

async function readRowsFromCsv(fileName, mapping) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) {
    console.warn(`WARN: CSV file not found, skipping: ${fileName}`);
    return [];
  }
  const skipRows = mapping.skipRows || 1; // skip header rows (1-based: skip first N rows)
  const rows = [];
  let lineNumber = 0;

  await new Promise((resolve, reject) => {
    const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
    rl.on('line', (line) => {
      lineNumber++;
      if (lineNumber <= skipRows) return;
      if (!line.trim()) return;
      const cols = parseCsvLine(line);
      // cols are 0-indexed; mapping uses 1-indexed colNums
      const get = (colNum) => (colNum ? (cols[colNum - 1] || '').trim() : '');
      const pickFirst = (colNums = []) => {
        for (const colNum of colNums) {
          const value = get(colNum);
          if (value) return value;
        }
        return '';
      };
      const dealDate = parseDate(get(mapping.dateCol));
      const broker = get(mapping.brokerCol) || null;
      const partner = mapping.partnerCols
        ? pickFirst(mapping.partnerCols) || null
        : mapping.partnerCol
          ? get(mapping.partnerCol) || null
          : null;
      const sourceLabel = mapping.fixedSource || get(mapping.sourceCol) || null;
      rows.push({
        source_file: fileName,
        row_number: lineNumber,
        deal_date: dealDate ? dealDate.toISOString().slice(0, 10) : null,
        deal_type: mapping.dealType,
        broker,
        partner,
        source_label: sourceLabel,
        gmv: parseNumeric(get(mapping.gmvCol)),
        gross: parseNumeric(get(mapping.grossCol)),
        net: parseNumeric(get(mapping.netCol)),
        payload: { rawLine: line, lineNumber, fileName },
      });
    });
    rl.on('close', resolve);
    rl.on('error', reject);
  });

  return rows;
}

async function main() {
  const connectionString = getConnectionString();
  const sslMode = (process.env.POSTGRES_SSL_MODE || 'require').toLowerCase();

  const client = new Client({
    connectionString,
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: false },
  });

  await client.connect();

  const runStart = await client.query(
    `INSERT INTO sync_runs (job_name, status, started_at, meta) VALUES ($1,$2,NOW(),$3::jsonb) RETURNING id`,
    ['sync_sales_excel_to_postgres', 'running', JSON.stringify({ mode: 'csv-import' })],
  );
  const runId = runStart.rows[0].id;

  try {
    const rows = [];
    const csvImports = [
      {
        fileName: 'offplan.csv',
        mapping: { dealType: 'Offplan', dateCol: 2, brokerCol: 5, partnerCol: 5, gmvCol: 7, grossCol: 10, netCol: 17, sourceCol: 3 },
      },
      {
        fileName: 'secondary.csv',
        mapping: { dealType: 'Secondary', dateCol: 1, brokerCol: 3, partnerCol: 4, gmvCol: 6, grossCol: 8, netCol: 15, sourceCol: 16 },
      },
      {
        fileName: 'rental.csv',
        mapping: { dealType: 'Rental', dateCol: 1, brokerCol: 3, partnerCol: 4, gmvCol: 6, grossCol: 8, netCol: 15, sourceCol: 16, skipRows: 2 },
      },
      {
        fileName: 'support.csv',
        mapping: { dealType: 'Support', dateCol: 1, brokerCol: 6, partnerCols: [4, 5], gmvCol: 7, grossCol: 9, netCol: 14, fixedSource: 'Support' },
      },
    ];

    for (const csv of csvImports) {
      rows.push(...(await readRowsFromCsv(csv.fileName, csv.mapping)));
    }

    if (rows.length === 0) {
      await client.query(
        `UPDATE sync_runs SET status='success', ended_at=NOW(), rows_processed=0, meta = COALESCE(meta,'{}'::jsonb) || $1::jsonb WHERE id=$2`,
        [JSON.stringify({ importedRows: 0, skipped: true, reason: 'No CSV files found' }), runId],
      );
      console.log('SUCCESS: sync_sales_excel_to_postgres. rows=0 (skipped: no CSV files found)');
      return;
    }

    await client.query('BEGIN');
    await client.query(`DELETE FROM sales_deals_raw`);

    const insertQuery = `
      INSERT INTO sales_deals_raw (
        source_file, row_number, deal_date, deal_type, broker, partner,
        source_label, gmv, gross, net, payload, synced_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11::jsonb,NOW()
      )
    `;

    for (const row of rows) {
      await client.query(insertQuery, [
        row.source_file,
        row.row_number,
        row.deal_date,
        row.deal_type,
        row.broker,
        row.partner,
        row.source_label,
        row.gmv,
        row.gross,
        row.net,
        JSON.stringify(row.payload || {}),
      ]);
    }

    await client.query('COMMIT');

    await client.query(
      `UPDATE sync_runs SET status='success', ended_at=NOW(), rows_processed=$1, meta = COALESCE(meta,'{}'::jsonb) || $2::jsonb WHERE id=$3`,
      [rows.length, JSON.stringify({ importedRows: rows.length }), runId],
    );

    console.log(`SUCCESS: sync_sales_excel_to_postgres. rows=${rows.length}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    await client.query(
      `UPDATE sync_runs SET status='failed', ended_at=NOW(), error_message=$1 WHERE id=$2`,
      [error instanceof Error ? error.message : String(error), runId],
    );
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('FAILED: sync_sales_excel_to_postgres', error.message || error);
  process.exit(1);
});
