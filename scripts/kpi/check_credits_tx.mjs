import fs from 'fs';
import path from 'path';

const PF_API_KEY = 'zSuEP.kGa187KLwbKnEwKYqs2tad492LNzaIag20';
const PF_API_SECRET = 'Ecmpp6GOnlCUuKtqPfUdlovoUB73msZA';

async function getPFToken() {
    const res = await fetch('https://atlas.propertyfinder.com/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: PF_API_KEY, apiSecret: PF_API_SECRET })
    });
    const data = await res.json();
    return data.accessToken;
}

async function checkCreditsTransactions() {
    console.log('--- CHECKING /credits/transactions ---');
    try {
        const token = await getPFToken();
        console.log('Fetching 10 pages of credits transactions...');
        const allTypes = new Set();
        for (let p = 1; p <= 10; p++) {
            const res = await fetch(`https://atlas.propertyfinder.com/v1/credits/transactions?perPage=50&page=${p}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            const data = await res.json();
            const txs = data.data || [];
            if (txs.length === 0) break;
            
            txs.forEach(t => {
                allTypes.add(t.description);
                // Check if it's a project spend
                const isProject = t.listingInfo?.projectId || t.description?.toLowerCase().includes('project') || t.description?.toLowerCase().includes('plus');
                if (isProject) {
                    console.log(`MATCHED Project TX: ${t.description} | Amount: ${t.transactionInfo?.amount} | Project: ${t.listingInfo?.projectId || 'N/A'} | Ref: ${t.listingInfo?.reference}`);
                }
            });
        }
        console.log('All found descriptions:', [...allTypes]);
    } catch (e) {
        console.error('ERROR:', e);
    }
}

checkCreditsTransactions();
