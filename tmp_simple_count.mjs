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

async function countListings2026(category, offeringType, token) {
  let page = 1;
  let total2026 = 0;
  let pages = 0;

  while (pages < 200) { // Limit to 200 pages max (10,000 listings)
    const url = `${API_URL}/listings?filter[category]=${category}&filter[offeringType]=${offeringType}&perPage=50&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();

    const rows = data.results || [];
    if (!rows.length) break;

    for (const listing of rows) {
      const createdAt = String(listing.createdAt || '').slice(0, 10);
      if (createdAt >= '2026-01-01' && createdAt <= '2026-12-31') {
        total2026++;
      }
    }
    
    pages++;
    process.stdout.write(`\r  Fetching ${category}/${offeringType}: page ${page}, found ${total2026} for 2026...`);

    if (!data.pagination?.nextPage) break;
    page = data.pagination.nextPage;
  }
  
  console.log('');
  return total2026;
}

const token = await getToken();

console.log('\n=== Counting PF Listings for 2026 ===\n');

const categories = [
  { name: 'Sell', category: 'residential', offeringType: 'sale' },
  { name: 'Rent', category: 'residential', offeringType: 'rent' },
  { name: 'Commercial Sell', category: 'commercial', offeringType: 'sale' },
  { name: 'Commercial Rent', category: 'commercial', offeringType: 'rent' },
];

const results = {};
let grandTotal = 0;

for (const cat of categories) {
  const count = await countListings2026(cat.category, cat.offeringType, token);
  results[cat.name] = count;
  grandTotal += count;
  console.log(`${cat.name.padEnd(20)}: ${count.toString().padStart(5)}`);
}

console.log(`\n${'─'.repeat(40)}`);
console.log(`${'TOTAL'.padEnd(20)}: ${grandTotal.toString().padStart(5)}`);
