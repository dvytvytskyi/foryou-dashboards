import 'dotenv/config';

const PF_API_KEY = process.env.PF_API_KEY;
const PF_API_SECRET = process.env.PF_API_SECRET;
const PF_API_URL = 'https://atlas.propertyfinder.com/v1';

async function getPFToken() {
  const res = await fetch(`${PF_API_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: PF_API_KEY, apiSecret: PF_API_SECRET })
  });
  const data = await res.json();
  if (!res.ok || !data?.accessToken) throw new Error(`PF token error: ${JSON.stringify(data)}`);
  return data.accessToken;
}

async function fetchAllListings(token) {
  const FILTERS = [
    { category: 'residential', offeringType: 'sale', label: 'Sale' },
    { category: 'residential', offeringType: 'rent', label: 'Rent' },
    { category: 'commercial', offeringType: 'sale', label: 'Sale' },
    { category: 'commercial', offeringType: 'rent', label: 'Rent' },
  ];
  const STATES = ['live', 'archived', 'unpublished', 'takendown'];
  const mapByRef = {}; // reference -> 'Sale' | 'Rent'
  const mapById = {};  // id -> 'Sale' | 'Rent'

  for (const f of FILTERS) {
    for (const state of STATES) {
      let page = 1;
      while (true) {
        const url = `${PF_API_URL}/listings?filter[category]=${f.category}&filter[offeringType]=${f.offeringType}&filter[state]=${state}&perPage=50&page=${page}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
        if (!res.ok) break;
        const data = await res.json();
        const listings = data.results || data.data || [];
        if (!listings.length) break;
        for (const l of listings) {
          if (l.reference) mapByRef[l.reference] = f.label;
          if (l.id) mapById[String(l.id)] = f.label;
        }
        if (!data.pagination?.nextPage) break;
        page = data.pagination.nextPage;
      }
    }
  }
  return { mapByRef, mapById };
}

async function main() {
  const token = await getPFToken();
  console.log('Got PF token ✓');

  process.stdout.write('Loading all listings to build ref→type map...\n');
  const { mapByRef, mapById } = await fetchAllListings(token);
  console.log(`Listing map built: ${Object.keys(mapByRef).length} refs, ${Object.keys(mapById).length} ids`);

  let allLeads = [];
  let page = 1;
  while (true) {
    process.stdout.write(`Fetching leads page ${page} (loaded ${allLeads.length})...\r`);
    const res = await fetch(`${PF_API_URL}/leads?perPage=50&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    if (!res.ok) break;
    const data = await res.json();
    const leads = data.data || data.results || [];
    if (!leads.length) break;
    allLeads.push(...leads);
    if (!data.pagination?.nextPage) break;
    page = data.pagination.nextPage;
  }
  console.log(`\nTotal leads fetched: ${allLeads.length}`);

  const leads2026 = allLeads.filter(l => (l.createdAt || '').startsWith('2026'));
  console.log(`Leads created in 2026: ${leads2026.length}`);

  const byType = { Sale: 0, Rent: 0, Project: 0, Unknown: 0 };
  for (const l of leads2026) {
    const entityType = String(l.entityType || '').toLowerCase();
    if (entityType === 'project') { byType.Project++; continue; }
    const ref = l.listing?.reference || '';
    const id = l.listing?.id ? String(l.listing.id) : '';
    const type = mapByRef[ref] || mapById[id] || null;
    if (type === 'Sale') byType.Sale++;
    else if (type === 'Rent') byType.Rent++;
    else byType.Unknown++;
  }

  console.log('\n--- 2026 leads by type ---');
  console.log(`  Sale:    ${byType.Sale}`);
  console.log(`  Rent:    ${byType.Rent}`);
  console.log(`  Project: ${byType.Project}`);
  console.log(`  Unknown: ${byType.Unknown}`);
  console.log(`  TOTAL:   ${leads2026.length}`);

  // Match leads → listings
  // Build full listing info map
  const listingInfo = {}; // ref -> { ref, id, type, title? }
  // We already have mapByRef, but need title too — fetch listing details
  // Instead, group leads by ref and show counts
  const byRef = {};
  let noRefCount = 0;

  for (const l of leads2026) {
    const entityType = String(l.entityType || '').toLowerCase();
    if (entityType === 'project') continue; // skip projects

    const ref = l.listing?.reference || '';
    const id = l.listing?.id ? String(l.listing.id) : '';
    const type = mapByRef[ref] || mapById[id] || 'Unknown';

    if (!ref) { noRefCount++; continue; }

    if (!byRef[ref]) {
      byRef[ref] = { ref, type, count: 0 };
    }
    byRef[ref].count++;
  }

  const rows = Object.values(byRef).sort((a, b) => b.count - a.count);

  console.log(`\n--- Leads per listing (2026, Sale+Rent, top 30) ---`);
  console.log(`${'Ref'.padEnd(20)} ${'Type'.padEnd(10)} Leads`);
  console.log('-'.repeat(40));
  for (const r of rows.slice(0, 30)) {
    console.log(`${r.ref.padEnd(20)} ${r.type.padEnd(10)} ${r.count}`);
  }
  console.log(`\nTotal unique listing refs with leads: ${rows.length}`);
  console.log(`Leads with no ref: ${noRefCount}`);

  // Summary: matched vs unknown
  const matched = rows.filter(r => r.type !== 'Unknown');
  const unknown = rows.filter(r => r.type === 'Unknown');
  console.log(`\nMatched to known listing: ${matched.length} refs (${matched.reduce((s,r)=>s+r.count,0)} leads)`);
  console.log(`Unknown/deleted listings:  ${unknown.length} refs (${unknown.reduce((s,r)=>s+r.count,0)} leads)`);
}

main().catch(console.error);
