import { readFileSync } from 'fs';

const rows = JSON.parse(readFileSync('pf_listings_report.json', 'utf8'));

const ourRows = rows.filter(r => (r.group || r.category) === 'Our');

// Aggregate by Category
const byCategory = {};
let totalLeads = 0, totalBudget = 0;

for (const r of ourRows) {
  const cat = r.Category || 'Unknown';
  if (!byCategory[cat]) byCategory[cat] = { listings: 0, leads: 0, budget: 0, leadsByMonth: {} };

  byCategory[cat].listings++;
  
  const lbm = r.LeadsByMonth || {};
  const bbm = r.BudgetByMonth || {};
  
  const allMonths = new Set([...Object.keys(lbm), ...Object.keys(bbm)]);
  
  let listingLeads = 0, listingBudget = 0;
  for (const m of allMonths) {
    const ml = Number(lbm[m] || 0);
    const mb = Number(bbm[m] || 0);
    listingLeads += ml;
    listingBudget += mb;
    byCategory[cat].leadsByMonth[m] = (byCategory[cat].leadsByMonth[m] || 0) + ml;
  }
  
  // fallback if no monthly data
  if (allMonths.size === 0) {
    listingLeads = Number(r.Leads || 0);
    listingBudget = Number(r.Budget || 0);
  }
  
  byCategory[cat].leads += listingLeads;
  byCategory[cat].budget += listingBudget;
  totalLeads += listingLeads;
  totalBudget += listingBudget;
}

console.log('=== Our Group — By Category ===');
for (const [cat, v] of Object.entries(byCategory)) {
  const cpl = v.leads > 0 ? (v.budget / v.leads).toFixed(0) : '-';
  console.log(`  ${cat}: listings=${v.listings}, leads=${v.leads}, budget=${v.budget.toFixed(0)} AED, CPL=${cpl} AED`);
  // Show monthly breakdown
  const months = Object.keys(v.leadsByMonth).sort();
  if (months.length > 0) {
    console.log(`    Months: ${months.map(m => `${m}=${v.leadsByMonth[m]}`).join(', ')}`);
  }
}
console.log(`\n  TOTAL: listings=${ourRows.length}, leads=${totalLeads}, budget=${totalBudget.toFixed(0)} AED, CPL=${totalLeads > 0 ? (totalBudget/totalLeads).toFixed(0) : '-'} AED`);

// Show each listing for Sell
console.log('\n=== Our Sell Listings ===');
const sellRows = ourRows.filter(r => r.Category === 'Sell');
for (const r of sellRows) {
  const lbm = r.LeadsByMonth || {};
  const leads = Object.values(lbm).reduce((a, v) => a + Number(v), 0) || Number(r.Leads || 0);
  const budget = Object.values(r.BudgetByMonth || {}).reduce((a, v) => a + Number(v), 0) || Number(r.Budget || 0);
  console.log(`  [${r.sheet_source}] ${(r.Title || '').slice(0, 50)} | leads=${leads} | budget=${budget.toFixed(0)} AED | status=${r.status}`);
}
