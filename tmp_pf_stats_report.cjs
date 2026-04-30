const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { Client } = require('pg');
require('dotenv').config();

function catNorm(c) {
  const v = String(c || '').trim();
  if (v === 'Sell' || v === 'Rent' || v === 'Commercial Sell' || v === 'Commercial Rent') return v;
  return 'Other';
}

function isMatchedRef(ref, permitKeys) {
  const r = String(ref || '').trim();
  if (!r) return false;
  if (permitKeys.has(r)) return true;
  const stripped = r.replace(/^for-you-real-estate-/, '').replace(/^0+/, '');
  if (stripped && permitKeys.has(stripped)) return true;
  if (/^\d+$/.test(r)) {
    for (let len = r.length + 1; len <= 10; len++) {
      if (permitKeys.has(r.padStart(len, '0'))) return true;
    }
  }
  return false;
}

(async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.resolve(process.cwd(), 'Property_Finder_Source.xlsx'));
  const sheets = [workbook.worksheets[1], workbook.worksheets[2]].filter(Boolean);

  let excelTotalProjects = 0;
  let excelWithPfLinks = 0;
  const excelBySheet = {};

  for (const sheet of sheets) {
    let total = 0;
    let withPfLinks = 0;

    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const project = String(row.getCell(2).value || '').trim();
      if (!project || /^project\s*name$/i.test(project)) return;

      const linkCell = row.getCell(12).value;
      const raw = linkCell == null
        ? ''
        : typeof linkCell === 'object'
          ? (linkCell.text || linkCell.hyperlink || String(linkCell.result || ''))
          : String(linkCell);
      const link = String(raw || '').trim();

      total += 1;
      if (/propertyfinder\.ae|go\//i.test(link)) withPfLinks += 1;
    });

    excelBySheet[sheet.name] = { totalProjects: total, withPfLinks };
    excelTotalProjects += total;
    excelWithPfLinks += withPfLinks;
  }

  const permitMap = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'pf_permit_group_map.json'), 'utf8'));
  const permitKeys = new Set(Object.keys(permitMap));

  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const listingsRes = await client.query(`
    SELECT reference, category, title
    FROM pf_listings_snapshot
    WHERE reference IS NOT NULL
      AND reference <> ''
      AND reference <> 'null'
      AND title <> 'Unattributed'
  `);

  const pfByCategory = {
    'Sell': { total: 0, matched: 0 },
    'Rent': { total: 0, matched: 0 },
    'Commercial Sell': { total: 0, matched: 0 },
    'Commercial Rent': { total: 0, matched: 0 },
    'Other': { total: 0, matched: 0 },
  };

  let pfTotal = 0;
  let pfMatched = 0;

  const projectSeen = new Set();
  const projectMatchedSeen = new Set();

  for (const r of listingsRes.rows) {
    const c = catNorm(r.category);
    const matched = isMatchedRef(r.reference, permitKeys);
    const title = String(r.title || '').trim();

    pfTotal += 1;
    pfByCategory[c].total += 1;
    if (matched) {
      pfMatched += 1;
      pfByCategory[c].matched += 1;
    }

    if (title) {
      projectSeen.add(title);
      if (matched) projectMatchedSeen.add(title);
    }
  }

  const amoRes = await client.query(`
    SELECT DISTINCT ON (category)
      category,
      pf_leads,
      matched_amo_leads,
      spam_count,
      qualified_count,
      ql_actual_count,
      meetings_count,
      deals_count,
      revenue_sum,
      updated_at
    FROM pf_amo_match_stats
    ORDER BY category, updated_at DESC
  `);

  const amoByCategory = {
    'Sell': { pf_leads: 0, matched_amo_leads: 0, spam_count: 0, qualified_count: 0, ql_actual_count: 0, meetings_count: 0, deals_count: 0, revenue_sum: 0 },
    'Rent': { pf_leads: 0, matched_amo_leads: 0, spam_count: 0, qualified_count: 0, ql_actual_count: 0, meetings_count: 0, deals_count: 0, revenue_sum: 0 },
    'Commercial Sell': { pf_leads: 0, matched_amo_leads: 0, spam_count: 0, qualified_count: 0, ql_actual_count: 0, meetings_count: 0, deals_count: 0, revenue_sum: 0 },
    'Commercial Rent': { pf_leads: 0, matched_amo_leads: 0, spam_count: 0, qualified_count: 0, ql_actual_count: 0, meetings_count: 0, deals_count: 0, revenue_sum: 0 },
    'Other': { pf_leads: 0, matched_amo_leads: 0, spam_count: 0, qualified_count: 0, ql_actual_count: 0, meetings_count: 0, deals_count: 0, revenue_sum: 0 },
  };

  for (const r of amoRes.rows) {
    const c = catNorm(r.category);
    const target = amoByCategory[c];
    target.pf_leads += Number(r.pf_leads || 0);
    target.matched_amo_leads += Number(r.matched_amo_leads || 0);
    target.spam_count += Number(r.spam_count || 0);
    target.qualified_count += Number(r.qualified_count || 0);
    target.ql_actual_count += Number(r.ql_actual_count || 0);
    target.meetings_count += Number(r.meetings_count || 0);
    target.deals_count += Number(r.deals_count || 0);
    target.revenue_sum += Number(r.revenue_sum || 0);
  }

  await client.end();

  const amoTotal = Object.values(amoByCategory).reduce((a, x) => {
    a.pf_leads += x.pf_leads;
    a.matched_amo_leads += x.matched_amo_leads;
    a.spam_count += x.spam_count;
    a.qualified_count += x.qualified_count;
    a.ql_actual_count += x.ql_actual_count;
    a.meetings_count += x.meetings_count;
    a.deals_count += x.deals_count;
    a.revenue_sum += x.revenue_sum;
    return a;
  }, { pf_leads: 0, matched_amo_leads: 0, spam_count: 0, qualified_count: 0, ql_actual_count: 0, meetings_count: 0, deals_count: 0, revenue_sum: 0 });

  const result = {
    excel: {
      totalProjects: excelTotalProjects,
      withPfLinks: excelWithPfLinks,
      withPfLinksPct: excelTotalProjects ? +(excelWithPfLinks / excelTotalProjects * 100).toFixed(2) : 0,
      bySheet: excelBySheet,
    },
    pfMatchedFromExcelMap: {
      totalListings: pfTotal,
      matchedListings: pfMatched,
      unmatchedListings: pfTotal - pfMatched,
      matchRatePct: pfTotal ? +(pfMatched / pfTotal * 100).toFixed(2) : 0,
      uniqueProjectsTotal: projectSeen.size,
      uniqueProjectsMatched: projectMatchedSeen.size,
      uniqueProjectsMatchRatePct: projectSeen.size ? +(projectMatchedSeen.size / projectSeen.size * 100).toFixed(2) : 0,
      byCategory: pfByCategory,
    },
    amoMatched: {
      total: amoTotal,
      totalMatchRatePct: amoTotal.pf_leads ? +(amoTotal.matched_amo_leads / amoTotal.pf_leads * 100).toFixed(2) : 0,
      byCategory: amoByCategory,
      byCategoryMatchRatePct: Object.fromEntries(Object.entries(amoByCategory).map(([k,v]) => [k, v.pf_leads ? +(v.matched_amo_leads / v.pf_leads * 100).toFixed(2) : 0])),
    },
  };

  console.log(JSON.stringify(result, null, 2));
})();
