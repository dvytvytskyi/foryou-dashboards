import { readFileSync } from 'fs';

const rows = JSON.parse(readFileSync('pf_listings_report.json', 'utf8'));

const byGroup = {};
const bySource = {};
for (const r of rows) {
  const g = r.group || r.category || 'Unknown';
  if (!byGroup[g]) byGroup[g] = { listings: 0, leads: 0, budget: 0 };
  byGroup[g].listings++;
  byGroup[g].leads += Number(r.Leads || 0);
  byGroup[g].budget += Number(r.Budget || 0);

  const s = r.sheet_source || 'Unknown';
  if (!bySource[s]) bySource[s] = { listings: 0, leads: 0, budget: 0 };
  bySource[s].listings++;
  bySource[s].leads += Number(r.Leads || 0);
  bySource[s].budget += Number(r.Budget || 0);
}

const total = rows.reduce((a, r) => ({
  listings: a.listings + 1,
  leads: a.leads + Number(r.Leads || 0),
  budget: a.budget + Number(r.Budget || 0)
}), { listings: 0, leads: 0, budget: 0 });

console.log('=== BY GROUP ===');
for (const [g, v] of Object.entries(byGroup)) {
  console.log(`  ${g}: listings=${v.listings}, leads=${v.leads}, budget=${v.budget.toFixed(0)} AED`);
}
console.log('\n=== BY SHEET SOURCE ===');
for (const [s, v] of Object.entries(bySource)) {
  console.log(`  ${s}: listings=${v.listings}, leads=${v.leads}, budget=${v.budget.toFixed(0)} AED`);
}
console.log('\n=== TOTAL ===');
console.log(`  listings=${total.listings}, leads=${total.leads}, budget=${total.budget.toFixed(0)} AED`);

// "Our" = group Our
const our = byGroup['Our'] || byGroup['our'] || null;
console.log('\n=== OUR GROUP ===');
console.log(JSON.stringify(our));

// Category breakdown for "Our"
const ourRows = rows.filter(r => (r.group || r.category) === 'Our' || (r.group || r.category) === 'our');
const ourByCategory = {};
for (const r of ourRows) {
  const c = r.Category || r.category || 'Unknown';
  if (!ourByCategory[c]) ourByCategory[c] = { listings: 0, leads: 0 };
  ourByCategory[c].listings++;
  ourByCategory[c].leads += Number(r.Leads || 0);
}
console.log('\n=== OUR BY CATEGORY ===');
for (const [c, v] of Object.entries(ourByCategory)) {
  console.log(`  ${c}: ${JSON.stringify(v)}`);
}
