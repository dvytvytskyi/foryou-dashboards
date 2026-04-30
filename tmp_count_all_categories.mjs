import 'dotenv/config';
import fs from 'fs';

const PF_API_URL = 'https://atlas.propertyfinder.com/v1';

// Get PF token
const tokenRes = await fetch(`${PF_API_URL}/auth/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ apiKey: process.env.PF_API_KEY, apiSecret: process.env.PF_API_SECRET }),
});
const tokenData = await tokenRes.json();
const pfToken = tokenData.accessToken;

if (!pfToken) {
  console.error('Failed to get PF token');
  process.exit(1);
}

console.log('Fetching PF leads for 2026...\n');

// Fetch all PF leads
const allLeads = [];
let page = 1;
while (true) {
  const resp = await fetch(
    `${PF_API_URL}/leads?perPage=50&page=${page}`,
    { headers: { Authorization: `Bearer ${pfToken}` } }
  );
  const data = await resp.json();
  const rows = data.data || [];
  if (!rows.length) break;
  
  for (const lead of rows) {
    const d = String(lead.createdAt || '').slice(0, 10);
    if (d >= '2026-01-01' && d <= '2026-12-31') {
      allLeads.push(lead);
    }
  }
  
  if (!data.pagination?.nextPage) break;
  page = data.pagination.nextPage;
}

// Group by category
const byCategory = {};
for (const lead of allLeads) {
  const category = lead.category || lead.type || 'Unknown';
  if (!byCategory[category]) byCategory[category] = 0;
  byCategory[category]++;
}

console.log('=== PF LEADS 2026 - ALL CATEGORIES ===\n');
const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
for (const [category, count] of sorted) {
  console.log(`${category.padEnd(25)}: ${count}`);
}

const total = allLeads.length;
console.log(`\n${'─'.repeat(40)}`);
console.log(`${'TOTAL'.padEnd(25)}: ${total}`);
