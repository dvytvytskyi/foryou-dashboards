/**
 * One-time (and re-runnable) importer:
 * reads the latest amocrm_export_leads_*.csv and writes
 * data/cache/pf_amo_leads_csv.json
 *
 * Run:  node scripts/kpi/import_pf_amo_csv.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_FILE = path.resolve(ROOT, 'data/cache/pf_amo_leads_csv.json');

function resolveCsvFile() {
  const explicit = (process.env.PF_AMO_CSV_FILE || '').trim();
  if (explicit) {
    const explicitPath = path.isAbsolute(explicit) ? explicit : path.resolve(ROOT, explicit);
    if (!fs.existsSync(explicitPath)) {
      throw new Error(`PF_AMO_CSV_FILE not found: ${explicitPath}`);
    }
    return explicitPath;
  }

  const candidates = fs
    .readdirSync(ROOT)
    .filter((name) => /^amocrm_export_leads_.*\.csv$/i.test(name))
    .map((name) => {
      const fullPath = path.resolve(ROOT, name);
      const stat = fs.statSync(fullPath);
      return { fullPath, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (!candidates.length) {
    throw new Error(`No amocrm_export_leads_*.csv files found in ${ROOT}`);
  }

  return candidates[0].fullPath;
}

// Dubai timezone offset = UTC+4 (fixed, no DST)
const DUBAI_OFFSET_SEC = 4 * 3600;

// Phone columns to extract
const PHONE_COLS = [
  'Рабочий телефон',
  'Рабочий прямой телефон',
  'Мобильный телефон',
  'Факс',
  'Домашний телефон',
  'Другой телефон',
  'Source phone',
];

function normalizePhone(v) {
  if (!v) return null;
  // strip leading ' (Excel artifact) and non-digits
  const digits = String(v).replace(/^'+/, '').replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (digits.length > 12) return digits.slice(-12);
  if (digits.length > 9) return digits.slice(-11);
  return digits;
}

/**
 * Parse Dubai "DD.MM.YYYY HH:MM:SS" → Unix timestamp (seconds, UTC)
 */
function parseDubaiDateToUnix(s) {
  if (!s || !s.trim()) return null;
  const m = s.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi, ss] = m;
  // Build UTC timestamp by subtracting Dubai offset
  const dubaiMs = Date.UTC(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(mi),
    Number(ss),
  );
  return Math.floor(dubaiMs / 1000) - DUBAI_OFFSET_SEC;
}

function classifyStage(stage) {
  const s = String(stage || '').toLowerCase().trim();
  if (s.includes('спам') || s.includes('spam') || s.includes('закрыто и не реализовано')) {
    // Business rule: closed-unrealized belongs to both no_answer/spam and ql_lead.
    if (s.includes('закрыто и не реализовано')) {
      return { isSpam: true, isQualified: true, isQlActual: false, isMeeting: false, isDeal: false };
    }
    return { isSpam: true, isQualified: false, isQlActual: false, isMeeting: false, isDeal: false };
  }
  if (s === 'квалификация пройдена') {
    return { isSpam: false, isQualified: true, isQlActual: true, isMeeting: false, isDeal: false };
  }
  if (s === 'заявка взята в работу') {
    return { isSpam: false, isQualified: true, isQlActual: true, isMeeting: false, isDeal: false };
  }
  if (s.includes('встреча') || s.includes('meeting') || s.includes('показ')) {
    return { isSpam: false, isQualified: true, isQlActual: true, isMeeting: true, isDeal: false };
  }
  if (s.includes('сделка') || s.includes('deal') || s.includes('закрыто и реализовано')) {
    return { isSpam: false, isQualified: true, isQlActual: false, isMeeting: true, isDeal: true };
  }
  // "закрыто и не реализовано", "заявка получена", etc.
  return { isSpam: false, isQualified: false, isQlActual: false, isMeeting: false, isDeal: false };
}

/**
 * Minimal CSV parser that handles quoted fields (RFC 4180-ish).
 * Returns array of row-objects keyed by header.
 */
function parseCsv(text) {
  const lines = [];
  // Split into raw lines preserving quoted newlines is complex;
  // AMO CSV is unlikely to have embedded newlines so we split on \n
  const rawLines = text.split(/\r?\n/);

  let inQuote = false;
  let current = '';
  const allLines = [];

  for (const rawLine of rawLines) {
    if (inQuote) {
      current += '\n' + rawLine;
    } else {
      current = rawLine;
    }
    // Count unescaped quotes to detect if still inside a quoted field
    const quoteCount = (current.match(/"/g) || []).length;
    inQuote = quoteCount % 2 !== 0;
    if (!inQuote) {
      allLines.push(current);
      current = '';
    }
  }
  if (current) allLines.push(current);

  const parseRow = (line) => {
    const fields = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { field += '"'; i++; }
          else inQ = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') { inQ = true; }
        else if (ch === ',') { fields.push(field); field = ''; }
        else { field += ch; }
      }
    }
    fields.push(field);
    return fields;
  };

  if (!allLines.length) return [];
  const headers = parseRow(allLines[0]);
  const rows = [];
  for (let i = 1; i < allLines.length; i++) {
    if (!allLines[i].trim()) continue;
    const fields = parseRow(allLines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = fields[j] ?? '';
    }
    rows.push(obj);
  }
  return rows;
}

function main() {
  const csvFile = resolveCsvFile();

  const text = fs.readFileSync(csvFile, 'utf8');
  const rows = parseCsv(text);
  console.log(`Parsed ${rows.length} rows from CSV: ${path.basename(csvFile)}`);

  const leads = [];
  let maxCreatedAt = 0;

  for (const row of rows) {
    const id = String(row['ID'] || '').trim();
    if (!id) continue;

    const createdAtUnix = parseDubaiDateToUnix(row['Дата создания сделки']);
    if (!createdAtUnix) continue;

    if (createdAtUnix > maxCreatedAt) maxCreatedAt = createdAtUnix;

    const phones = [];
    for (const col of PHONE_COLS) {
      const p = normalizePhone(row[col]);
      if (p && !phones.includes(p)) phones.push(p);
    }

    const stage = String(row['Этап сделки'] || '').trim();
    const classification = classifyStage(stage);

    const createdDate = new Date(createdAtUnix * 1000).toISOString();
    const createdMonth = createdDate.slice(0, 7);

    const pfLeadId = String(row['PF Lead ID'] || '').trim() || null;
    const pfListingRef = String(row['PF Listing Ref'] || '').trim() || null;
    const pfCategory = String(row['PF Category'] || '').trim() || null;
    const pfChannelType = String(row['PF Channel Type'] || '').trim() || null;
    const pfStatus = String(row['PF Status'] || '').trim() || null;
    const pfListingUrl = String(row['PF Listing URL'] || '').trim() || null;

    leads.push({
      id,
      created_at: createdAtUnix,
      created_month: createdMonth,
      phones,
      stage,
      pf_lead_id: pfLeadId,
      pf_listing_ref: pfListingRef,
      pf_category: pfCategory,
      pf_channel_type: pfChannelType,
      pf_status: pfStatus,
      pf_listing_url: pfListingUrl,
      ...classification,
    });
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const output = {
    source_file: path.basename(csvFile),
    generated_at: new Date().toISOString(),
    csv_last_lead_at: maxCreatedAt,
    csv_last_lead_iso: new Date(maxCreatedAt * 1000).toISOString(),
    total: leads.length,
    leads,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`✓ Saved ${leads.length} leads to ${OUT_FILE}`);
  console.log(`  Date range: ${leads[0]?.created_month} → ${output.csv_last_lead_iso.slice(0, 10)}`);
  console.log(`  CSV cutoff (for AMO delta sync): ${output.csv_last_lead_iso}`);

  // Summary by stage
  const byStagge = {};
  for (const l of leads) byStagge[l.stage] = (byStagge[l.stage] || 0) + 1;
  console.log('  By stage:', JSON.stringify(byStagge));
}

main();
