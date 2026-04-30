const API_URL = 'https://atlas.propertyfinder.com/v1';
require('dotenv').config();

async function getToken() {
  const apiKey = process.env.PF_API_KEY;
  const apiSecret = process.env.PF_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('Missing PF_API_KEY/PF_API_SECRET');

  const res = await fetch(`${API_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret }),
  });
  const data = await res.json();
  if (!res.ok || !data?.accessToken) throw new Error(`PF token error: ${JSON.stringify(data)}`);
  return data.accessToken;
}

function scanValue(value, path, out) {
  if (value == null) return;

  if (typeof value === 'string') {
    const v = value.toLowerCase();
    if (v.includes('primary')) {
      out.primary.push({ path, value });
      if (/primary\s+leads?/.test(v)) out.primaryLeads.push({ path, value });
      if (/primary\s+listings?/.test(v)) out.primaryListings.push({ path, value });
      if (/primary\s+plus/.test(v)) out.primaryPlus.push({ path, value });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, idx) => scanValue(item, `${path}[${idx}]`, out));
    return;
  }

  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      scanValue(v, path ? `${path}.${k}` : k, out);
    }
  }
}

function initScan() {
  return { primary: [], primaryLeads: [], primaryListings: [], primaryPlus: [] };
}

function dedupeSamples(arr, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const key = `${x.path}::${x.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(x);
    if (out.length >= limit) break;
  }
  return out;
}

async function fetchAllListings(token) {
  const dims = [
    ['residential', 'sale'],
    ['residential', 'rent'],
    ['commercial', 'sale'],
    ['commercial', 'rent'],
  ];
  const states = ['live', 'archived', 'unpublished', 'takendown'];
  const out = [];

  for (const [category, offeringType] of dims) {
    for (const state of states) {
      let page = 1;
      while (true) {
        const url = `${API_URL}/listings?filter[category]=${category}&filter[offeringType]=${offeringType}&filter[state]=${state}&perPage=50&page=${page}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
        const data = await res.json();
        if (!res.ok) throw new Error(`Listings fetch failed: ${res.status} ${JSON.stringify(data).slice(0,180)}`);
        const rows = data.results || [];
        if (!rows.length) break;
        out.push(...rows);
        if (!data.pagination?.nextPage) break;
        page = data.pagination.nextPage;
      }
    }
  }
  return out;
}

async function fetchAllLeads(token, maxPages = 500) {
  const out = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${API_URL}/leads?perPage=50&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Leads fetch failed: ${res.status} ${JSON.stringify(data).slice(0,180)}`);
    const rows = data.data || data.results || [];
    if (!rows.length) break;
    out.push(...rows);
    if (!data.pagination?.nextPage) break;
    page = data.pagination.nextPage;
    if (page > maxPages) break;
  }
  return out;
}

async function fetchAllCredits(token, maxPages = 200) {
  const out = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${API_URL}/credits/transactions?type=credits&perPage=50&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Credits fetch failed: ${res.status} ${JSON.stringify(data).slice(0,180)}`);
    const rows = data.data || data.results || [];
    if (!rows.length) break;
    out.push(...rows);
    if (!data.pagination?.nextPage) break;
    page = data.pagination.nextPage;
    if (page > maxPages) break;
  }
  return out;
}

(async () => {
  const token = await getToken();

  const [listings, leads, credits] = await Promise.all([
    fetchAllListings(token),
    fetchAllLeads(token),
    fetchAllCredits(token),
  ]);

  const listingScan = initScan();
  listings.forEach((row, i) => scanValue(row, `listings[${i}]`, listingScan));

  const leadScan = initScan();
  leads.forEach((row, i) => scanValue(row, `leads[${i}]`, leadScan));

  const creditScan = initScan();
  credits.forEach((row, i) => scanValue(row, `credits[${i}]`, creditScan));

  const report = {
    source: 'Property Finder API direct full-text scan',
    scanned: {
      listings: listings.length,
      leads: leads.length,
      credits: credits.length,
    },
    matches: {
      listings: {
        primary: listingScan.primary.length,
        primaryLeads: listingScan.primaryLeads.length,
        primaryListings: listingScan.primaryListings.length,
        primaryPlus: listingScan.primaryPlus.length,
      },
      leads: {
        primary: leadScan.primary.length,
        primaryLeads: leadScan.primaryLeads.length,
        primaryListings: leadScan.primaryListings.length,
        primaryPlus: leadScan.primaryPlus.length,
      },
      credits: {
        primary: creditScan.primary.length,
        primaryLeads: creditScan.primaryLeads.length,
        primaryListings: creditScan.primaryListings.length,
        primaryPlus: creditScan.primaryPlus.length,
      },
    },
    samples: {
      listings_primary: dedupeSamples(listingScan.primary, 6),
      leads_primary: dedupeSamples(leadScan.primary, 6),
      credits_primary: dedupeSamples(creditScan.primary, 6),
      listings_primaryLeads: dedupeSamples(listingScan.primaryLeads, 4),
      leads_primaryLeads: dedupeSamples(leadScan.primaryLeads, 4),
      listings_primaryListings: dedupeSamples(listingScan.primaryListings, 4),
      leads_primaryListings: dedupeSamples(leadScan.primaryListings, 4),
      listings_primaryPlus: dedupeSamples(listingScan.primaryPlus, 4),
      leads_primaryPlus: dedupeSamples(leadScan.primaryPlus, 4),
    },
  };

  console.log(JSON.stringify(report, null, 2));
})();
