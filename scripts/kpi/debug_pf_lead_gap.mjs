import fs from 'fs';
import path from 'path';

const PF_API_KEY = 'zSuEP.kGa187KLwbKnEwKYqs2tad492LNzaIag20';
const PF_API_SECRET = 'Ecmpp6GOnlCUuKtqPfUdlovoUB73msZA';

const JSON_FILE = path.resolve('./pf_listings_report.json');

async function getPFToken() {
    const res = await fetch('https://atlas.propertyfinder.com/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: PF_API_KEY, apiSecret: PF_API_SECRET })
    });
    const data = await res.json();
    return data.accessToken;
}

async function debugLeads() {
    const token = await getPFToken();
    let allLeads = [];
    for (let page = 1; page <= 50; page++) {
        const res = await fetch(`https://atlas.propertyfinder.com/v1/leads?perPage=50&page=${page}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        const data = await res.json();
        const leads = data.data || [];
        if (leads.length === 0) break;
        allLeads.push(...leads);
    }

    const pfData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
    const knownRefs = new Set(pfData.map(i => i.Reference));

    let matched = 0;
    let unmatched = 0;
    const unmatchedRefs = {};

    allLeads.forEach(l => {
        const ref = l.listing?.reference || l.project?.reference || 'NO_REF';
        if (knownRefs.has(ref)) {
            matched++;
        } else {
            unmatched++;
            unmatchedRefs[ref] = (unmatchedRefs[ref] || 0) + 1;
        }
    });

    console.log(`TOTAL LEADS: ${allLeads.length}`);
    console.log(`MATCHED TO JSON: ${matched}`);
    console.log(`UNMATCHED: ${unmatched}`);
    console.log('\nTop Unmatched Refs:');
    console.table(Object.entries(unmatchedRefs).sort((a,b)=>b[1]-a[1]).slice(0, 10));
}

debugLeads().catch(console.error);
