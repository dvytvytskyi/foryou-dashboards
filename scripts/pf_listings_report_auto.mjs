// Автоматичний збір даних: отримання токена + збір лістингів
// Node.js (ESM)
import fetch from 'node-fetch';
import fs from 'fs/promises';

const API_URL = 'https://atlas.propertyfinder.com/v1';
const apiKey = 'zSuEP.kGa187KLwbKnEwKYqs2tad492LNzaIag20';
const apiSecret = 'Ecmpp6GOnlCUuKtqPfUdlovoUB73msZA';

const CATEGORIES = [
  { name: 'Sell', category: 'residential', offeringType: 'sale' },
  { name: 'Rent', category: 'residential', offeringType: 'rent' },
  { name: 'Commercial Sell', category: 'commercial', offeringType: 'sale' },
  { name: 'Commercial Rent', category: 'commercial', offeringType: 'rent' },
];

async function getToken() {
  const res = await fetch(`${API_URL}/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ apiKey, apiSecret })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Token error: ' + JSON.stringify(data));
  return data.accessToken;
}

async function fetchAllListings(category, offeringType, state, token) {
  let page = 1;
  let listings = [];
  let hasMore = true;
  while (hasMore) {
    const url = `${API_URL}/listings?filter[category]=${category}&filter[offeringType]=${offeringType}&filter[state]=${state}&perPage=50&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Error fetching listings:', url, data);
      break;
    }
    listings = listings.concat(data.results || []);
    hasMore = data.pagination && data.pagination.nextPage;
    page = data.pagination?.nextPage || 0;
  }
  return listings;
}

async function fetchAllListingsAllStates(category, offeringType, token) {
  const states = ['live', 'archived', 'unpublished', 'takendown'];
  let all = [];
  for (const state of states) {
    const res = await fetchAllListings(category, offeringType, state, token);
    console.log(`Fetched ${res.length} listings for ${category} ${offeringType} state=${state}`);
    all = all.concat(res);
  }
  return all;
}

async function fetchCreditsTransactions(token) {
  let page = 1;
  let txs = [];
  let hasMore = true;
  while (hasMore) {
    const res = await fetch(`${API_URL}/credits/transactions?perPage=50&page=${page}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Error fetching credits:', data);
      break;
    }
    txs = txs.concat(data.data || []);
    hasMore = data.pagination && data.pagination.nextPage;
    page = data.pagination?.nextPage || 0;
  }
  return txs;
}

async function fetchLeadsCount(listingId, token) {
  // Отримуємо всі ліди (максимум 1000 на лістинг)
  let page = 1;
  let allLeads = [];
  let hasMore = true;
  while (hasMore) {
    const res = await fetch(`${API_URL}/leads?listingId=${listingId}&perPage=100&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) {
      console.error('Error fetching leads:', listingId, data);
      break;
    }
    allLeads = allLeads.concat(data.results || []);
    hasMore = data.pagination && data.pagination.nextPage;
    page = data.pagination?.nextPage || 0;
  }
  return allLeads;
}

async function main() {
  const token = await getToken();
  console.log('Access token received');
  const credits = await fetchCreditsTransactions(token);
  console.log('Fetched credits transactions:', credits.length);
  // Debug: Вивід перших двох транзакцій
  // console.log('Sample credit transaction 1:', JSON.stringify(credits[0], null, 2));
  // console.log('Sample credit transaction 2:', JSON.stringify(credits[1], null, 2));
  // Формуємо мапу по reference з деталізацією по місяцях
  const creditsByReference = {};
  const creditsByReferenceByMonth = {};
  for (const tx of credits) {
    const ref = tx.listingInfo?.reference;
    if (!ref) continue;
    if (tx.transactionInfo?.action === 'charge' && tx.transactionInfo?.type === 'credits') {
      // Загальна сума
      if (!creditsByReference[ref]) creditsByReference[ref] = 0;
      creditsByReference[ref] += Math.abs(tx.transactionInfo.amount || 0);
      // По місяцях
      const month = (tx.createdAt || '').slice(0, 7); // YYYY-MM
      if (!creditsByReferenceByMonth[ref]) creditsByReferenceByMonth[ref] = {};
      if (!creditsByReferenceByMonth[ref][month]) creditsByReferenceByMonth[ref][month] = 0;
      creditsByReferenceByMonth[ref][month] += Math.abs(tx.transactionInfo.amount || 0);
    }
  }

  let rows = [];
  for (const cat of CATEGORIES) {
    const listings = await fetchAllListingsAllStates(cat.category, cat.offeringType, token);
    console.log(`Total listings for ${cat.name}:`, listings.length);
    for (const l of listings) {
      const budget = creditsByReference[l.reference] || 0;
      const budgetByMonth = creditsByReferenceByMonth[l.reference] || {};
      const leads = await fetchLeadsCount(l.reference, token);
      const leadsCount = leads.length;
      const leadsIds = leads.map(ld => ld.id);
      rows.push({
        Category: cat.name,
        Reference: l.reference,
        Title: l.title?.en || '',
        CreatedAt: l.createdAt,
        Budget: budget,
        BudgetByMonth: budgetByMonth,
        Leads: leadsCount,
        LeadsIds: leadsIds
      });
    }
  }
  await fs.writeFile('pf_listings_report.json', JSON.stringify(rows, null, 2));
  console.log('Done! Data saved to pf_listings_report.json');
}

main().catch(e => { console.error(e); process.exit(1); });
