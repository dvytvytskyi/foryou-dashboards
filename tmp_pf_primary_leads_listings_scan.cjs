require('dotenv').config();

const API_URL = 'https://atlas.propertyfinder.com/v1';

async function getToken() {
  const apiKey = process.env.PF_API_KEY;
  const apiSecret = process.env.PF_API_SECRET;
  const res = await fetch(`${API_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret }),
  });
  const data = await res.json();
  if (!res.ok || !data?.accessToken) throw new Error(`Token failed: ${JSON.stringify(data)}`);
  return data.accessToken;
}

function collectMatches(obj, basePath, out) {
  function walk(v, p) {
    if (v == null) return;
    if (typeof v === 'string') {
      const s = v.toLowerCase();
      if (s.includes('primary')) {
        out.primary += 1;
        if (out.samples.primary.length < 5) out.samples.primary.push({ path: p, value: v });
      }
      if (/primary\s+leads?/.test(s)) {
        out.primaryLeads += 1;
        if (out.samples.primaryLeads.length < 5) out.samples.primaryLeads.push({ path: p, value: v });
      }
      if (/primary\s+listings?/.test(s)) {
        out.primaryListings += 1;
        if (out.samples.primaryListings.length < 5) out.samples.primaryListings.push({ path: p, value: v });
      }
      if (/primary\s+plus/.test(s)) {
        out.primaryPlus += 1;
        if (out.samples.primaryPlus.length < 5) out.samples.primaryPlus.push({ path: p, value: v });
      }
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${p}[${i}]`));
      return;
    }
    if (typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        walk(val, p ? `${p}.${k}` : k);
      }
    }
  }
  walk(obj, basePath);
}

function initOut() {
  return {
    primary: 0,
    primaryLeads: 0,
    primaryListings: 0,
    primaryPlus: 0,
    samples: {
      primary: [],
      primaryLeads: [],
      primaryListings: [],
      primaryPlus: [],
    },
  };
}

async function fetchListings(token) {
  const dims = [
    ['residential', 'sale'],
    ['residential', 'rent'],
    ['commercial', 'sale'],
    ['commercial', 'rent'],
  ];
  const states = ['live', 'archived', 'unpublished', 'takendown'];
  const rows = [];

  for (const [category, offeringType] of dims) {
    for (const state of states) {
      let page = 1;
      while (true) {
        const url = `${API_URL}/listings?filter[category]=${category}&filter[offeringType]=${offeringType}&filter[state]=${state}&perPage=50&page=${page}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
        const data = await res.json();
        if (!res.ok) throw new Error(`Listings failed ${res.status}: ${JSON.stringify(data).slice(0, 160)}`);
        const batch = data.results || [];
        if (!batch.length) break;
        rows.push(...batch);
        if (!data.pagination?.nextPage) break;
        page = data.pagination.nextPage;
      }
    }
  }

  return rows;
}

async function fetchLeads(token) {
  const rows = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${API_URL}/leads?perPage=50&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Leads failed ${res.status}: ${JSON.stringify(data).slice(0, 160)}`);
    const batch = data.data || data.results || [];
    if (!batch.length) break;
    rows.push(...batch);
    if (!data.pagination?.nextPage) break;
    page = data.pagination.nextPage;
    if (page > 1000) break;
  }
  return rows;
}

(async () => {
  const token = await getToken();
  const [listings, leads] = await Promise.all([fetchListings(token), fetchLeads(token)]);

  const listingOut = initOut();
  listings.forEach((row, i) => collectMatches(row, `listings[${i}]`, listingOut));

  const leadsOut = initOut();
  leads.forEach((row, i) => collectMatches(row, `leads[${i}]`, leadsOut));

  console.log(JSON.stringify({
    scanned: { listings: listings.length, leads: leads.length },
    listings: listingOut,
    leads: leadsOut,
  }, null, 2));
})();
