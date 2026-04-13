// Скрипт для збору даних по лістингах Property Finder
// Node.js (ESM)
// Потрібно встановити: node-fetch (або використовувати native fetch з Node 18+)

import fetch from 'node-fetch';
import fs from 'fs/promises';

const API_URL = 'https://atlas.propertyfinder.com/v1';
const ACCESS_TOKEN = process.env.PF_TOKEN; // Задайте токен через змінну середовища

const CATEGORIES = [
  { name: 'Sell', category: 'residential', offeringType: 'sale' },
  { name: 'Rent', category: 'residential', offeringType: 'rent' },
  { name: 'Commercial Sell', category: 'commercial', offeringType: 'sale' },
  { name: 'Commercial Rent', category: 'commercial', offeringType: 'rent' },
];


async function fetchAllListings(category, offeringType, state) {
  let page = 1;
  let listings = [];
  let hasMore = true;
  while (hasMore) {
    const url = `${API_URL}/listings?filter[category]=${category}&filter[offeringType]=${offeringType}&filter[state]=${state}&perPage=50&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
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

async function fetchAllListingsAllStates(category, offeringType) {
  // States: live, archived, unpublished, takendown
  const states = ['live', 'archived', 'unpublished', 'takendown'];
  let all = [];
  for (const state of states) {
    const res = await fetchAllListings(category, offeringType, state);
    console.log(`Fetched ${res.length} listings for ${category} ${offeringType} state=${state}`);
    all = all.concat(res);
  }
  return all;
}

async function fetchCreditsTransactions() {
  let page = 1;
  let txs = [];
  let hasMore = true;
  while (hasMore) {
    const res = await fetch(`${API_URL}/credits/transactions?perPage=50&page=${page}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
    const data = await res.json();
    txs = txs.concat(data.data || []);
    hasMore = data.pagination && data.pagination.nextPage;
    page = data.pagination?.nextPage || 0;
  }
  return txs;
}

async function fetchLeadsCount(listingId) {
  const res = await fetch(`${API_URL}/leads?listingId=${listingId}&perPage=1`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
  });
  const data = await res.json();
  return data.pagination?.total || 0;
}

async function main() {
  const credits = await fetchCreditsTransactions();
  console.log('Fetched credits transactions:', credits.length);
  // Групуємо транзакції по listingId
  const creditsByListing = {};
  for (const tx of credits) {
    const id = tx.listingInfo?.id;
    if (!id) continue;
    if (!creditsByListing[id]) creditsByListing[id] = 0;
    if (tx.transactionInfo?.action === 'charge' && tx.transactionInfo?.type === 'credits') {
      creditsByListing[id] += Math.abs(tx.transactionInfo.amount || 0);
    }
  }

  let rows = [];
  for (const cat of CATEGORIES) {
    const listings = await fetchAllListingsAllStates(cat.category, cat.offeringType);
    console.log(`Total listings for ${cat.name}:`, listings.length);
    for (const l of listings) {
      const budget = creditsByListing[l.id] || 0;
      const leadsCount = await fetchLeadsCount(l.id);
      rows.push({
        Category: cat.name,
        Reference: l.reference,
        Title: l.title?.en || '',
        CreatedAt: l.createdAt,
        Budget: budget,
        Leads: leadsCount
      });
    }
  }
  await fs.writeFile('pf_listings_report.json', JSON.stringify(rows, null, 2));
  console.log('Done! Data saved to pf_listings_report.json');
}

main().catch(console.error);
