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

async function checkProjectTransactions() {
    console.log('--- CHECKING TRANSACTIONS FOR PROJECTS ---');
    try {
        const token = await getPFToken();
        const allTypes = new Set();
        console.log('Fetching 6 pages of transactions...');
        for (let p = 1; p <= 6; p++) {
            const res = await fetch(`https://atlas.propertyfinder.com/v1/transactions?perPage=50&page=${p}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            const data = await res.json();
            const txs = data.data || [];
            if (txs.length === 0) break;
            
            txs.forEach(t => {
                allTypes.add(t.type);
                if (t.type?.toLowerCase().includes('project') || t.entityType?.toLowerCase() === 'project' || t.projectId) {
                    console.log(`MATCHED: ${t.type} | ID: ${t.id} | Amount: ${t.amount} | Project: ${t.projectId || 'N/A'}`);
                }
            });
        }
        console.log('All found types:', [...allTypes]);

    } catch (e) {
        console.error('ERROR:', e);
    }
}

checkProjectTransactions();
