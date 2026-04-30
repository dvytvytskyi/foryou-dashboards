import 'dotenv/config';

const API_URL = 'https://atlas.propertyfinder.com/v1';

async function getToken() {
  const res = await fetch(`${API_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: process.env.PF_API_KEY, apiSecret: process.env.PF_API_SECRET }),
  });
  const data = await res.json();
  return data.accessToken;
}

async function fetchAllListings(category, offeringType, token) {
  let page = 1;
  let all = [];

  while (true) {
    // Don't use state filter - fetch all
    const url = `${API_URL}/listings?filter[category]=${category}&filter[offeringType]=${offeringType}&perPage=50&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();

    if (!res.ok) throw new Error(`PF listings fetch failed: ${JSON.stringify(data)}`);

    const rows = data.results || [];
    if (!rows.length) break;

    all = all.concat(rows);
    if (!data.pagination?.nextPage) break;
    page = data.pagination.nextPage;
  }

  return all;
}

const token = await getToken();

console.log('Fetching PF listings for 2026...\n');

// Fetch each category for 'all' state (includes active, sold, leased, unlisted, etc)
const categories = [
  { name: 'Sell', category: 'residential', offeringType: 'sale' },
  { name: 'Rent', category: 'residential', offeringType: 'rent' },
  { name: 'Commercial Sell', category: 'commercial', offeringType: 'sale' },
  { name: 'Commercial Rent', category: 'commercial', offeringType: 'rent' },
];

const results = {};

for (const cat of categories) {
  const listings = await fetchAllListings(cat.category, cat.offeringType, token);
  
  // Count by month for 2026
  const byMonth = {};
  let total2026 = 0;
  
  for (const listing of listings) {
    const createdAt = String(listing.createdAt || '').slice(0, 10);
    if (createdAt >= '2026-01-01' && createdAt <= '2026-12-31') {
      total2026++;
      const month = createdAt.slice(0, 7);
      byMonth[month] = (byMonth[month] || 0) + 1;
    }
  }
  
  results[cat.name] = {
    total2026,
    byMonth: Object.entries(byMonth).sort()
  };
  
  console.log(`${cat.name}: ${total2026} listings for 2026`);
}

console.log(`\n${'═'.repeat(60)}\n`);

let grandTotal = 0;
for (const [name, data] of Object.entries(results)) {
  console.log(`\n${name}: ${data.total2026}`);
  grandTotal += data.total2026;
  
  if (data.byMonth.length > 0) {
    console.log('  By month:');
    for (const [month, count] of data.byMonth) {
      console.log(`    ${month}: ${count}`);
    }
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`TOTAL 2026: ${grandTotal}`);
