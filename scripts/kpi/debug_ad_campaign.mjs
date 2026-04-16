import fs from 'fs';
import path from 'path';

const PF_API_KEY = process.env.PF_API_KEY || ''; 
const PF_API_SECRET = process.env.PF_API_SECRET || ''; 

async function getPFToken() {
    const res = await fetch('https://atlas.propertyfinder.com/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: PF_API_KEY, apiSecret: PF_API_SECRET })
    });
    const data = await res.json();
    return data.accessToken;
}

async function debugAdCampaignTxs() {
    console.log('--- SEARCHING FOR AD CAMPAIGN TRANSACTIONS ---');
    try {
        const token = await getPFToken();
        for (let p = 1; p <= 5; p++) {
            const res = await fetch(`https://atlas.propertyfinder.com/v1/credits/transactions?perPage=50&page=${p}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            const data = await res.json();
            const txs = data.data || [];
            if (txs.length === 0) break;
            
            txs.forEach(t => {
                if (t.description?.includes('Ad Campaign')) {
                    console.log(JSON.stringify(t, null, 2));
                }
            });
        }
    } catch (e) {
        console.error('ERROR:', e);
    }
}

debugAdCampaignTxs();
