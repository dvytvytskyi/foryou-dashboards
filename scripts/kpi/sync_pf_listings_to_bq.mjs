import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PF_API_KEY = 'OJIlJ.2x35n9PkjxHYTwuN5xI3UsqLxXqUR9c44R';
const PF_API_SECRET = '1mAsFUrBgd0aPFHc6BvGja25DbKe1Bb5';
const CREDIT_PRICE_AED = 1327;
const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE
});

async function getPFToken() {
    const res = await fetch('https://atlas.propertyfinder.com/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: PF_API_KEY, apiSecret: PF_API_SECRET })
    });
    const data = await res.json();
    return data.accessToken;
}

async function fetchCategoryListings(token, offering, category, label) {
    const url = `https://atlas.propertyfinder.com/v1/listings?perPage=100&filter[offeringType]=${offering}&filter[category]=${category}`;
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(l => ({
        reference: l.reference,
        offering_type: offering,
        category: category,
        dashboard_label: label
    }));
}

async function fetchAllTransactions(token) {
    let all = [];
    let page = 1;
    let hasNext = true;

    console.log('Deep-diving into transaction history (this may take a moment)...');
    while (hasNext) {
        const res = await fetch(`https://atlas.propertyfinder.com/v1/credits/transactions?perPage=100&page=${page}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        const data = await res.json();
        const items = data.data || [];
        all.push(...items);
        
        console.log(`Transactions Page ${page}: fetched ${items.length} records.`);
        
        if (items.length < 100 || page >= 40) { // Викачуємо до 4000 транзакцій для повної історії
            hasNext = false;
        } else {
            page++;
        }
    }
    return all;
}

async function syncAll() {
    try {
        const token = await getPFToken();
        
        // 1. Listings
        console.log('Fetching all active listings...');
        const [sell, rent, cSell, cRent] = await Promise.all([
            fetchCategoryListings(token, 'sale', 'residential', 'Sell'),
            fetchCategoryListings(token, 'rent', 'residential', 'Rent'),
            fetchCategoryListings(token, 'sale', 'commercial', 'Commercial Sell'),
            fetchCategoryListings(token, 'rent', 'commercial', 'Commercial Rent'),
        ]);
        const listings = [...sell, ...rent, ...cSell, ...cRent];

        // 2. Transactions (HISTORY)
        const transactions = await fetchAllTransactions(token);
        
        // 3. Aggregate Credits
        const budgetMap = {};
        transactions.forEach(t => {
            // Фільтруємо ТІЛЬКИ списання по кредитам
            if ((t.transactionInfo?.action === 'charge' || t.transactionInfo?.amount < 0) && t.listingInfo?.reference) {
                const ref = t.listingInfo.reference;
                const creditsSpent = Math.abs(t.transactionInfo.amount || 0);
                budgetMap[ref] = (budgetMap[ref] || 0) + (creditsSpent * CREDIT_PRICE_AED);
            }
        });

        const finalRows = listings.map(l => ({
            reference: l.reference,
            offering_type: l.offering_type,
            category: l.category,
            dashboard_label: l.dashboard_label,
            budget: budgetMap[l.reference] || 0,
            updated_at: bq.timestamp(new Date())
        }));

        const dataset = bq.dataset('foryou_analytics');
        const table = dataset.table('pf_listings');

        const [exists] = await table.exists();
        if (exists) await table.delete();
        
        await dataset.createTable('pf_listings', {
            schema: [
                { name: 'reference', type: 'STRING' },
                { name: 'offering_type', type: 'STRING' },
                { name: 'category', type: 'STRING' },
                { name: 'dashboard_label', type: 'STRING' },
                { name: 'budget', type: 'FLOAT' },
                { name: 'updated_at', type: 'TIMESTAMP' }
            ]
        });

        await new Promise(r => setTimeout(r, 2000));
        await table.insert(finalRows);
        
        console.log(`SUCCESS: Deep sync complete. ${finalRows.length} listings aggregated with historical budgets.`);

    } catch (e) {
        console.error('Deep sync failed:', e.stack);
    }
}

syncAll();
