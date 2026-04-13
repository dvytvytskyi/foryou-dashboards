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
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to get token: ${res.status} ${text}`);
    }
    const data = await res.json();
    return data.accessToken;
}

async function fetchAllLeads(token) {
    let allLeads = [];
    let page = 1;
    console.log('--- FETCHING LEADS FROM PROPERTY FINDER ---');
    while (true) {
        process.stdout.write(`Page ${page}...\r`);
        const res = await fetch(`https://atlas.propertyfinder.com/v1/leads?perPage=50&page=${page}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (!res.ok) {
            console.error(`Error on page ${page}: ${res.status}`);
            break;
        }
        const data = await res.json();
        const leads = data.data || [];
        if (leads.length === 0) break;
        allLeads.push(...leads);
        page++;
        if (page > 50) break; // Safety limit
    }
    console.log(`\nFetched ${allLeads.length} leads total.`);
    return allLeads;
}

async function updateJsonWithLeads() {
    try {
        const token = await getPFToken();
        const leads = await fetchAllLeads(token);

        // Map leads by reference
        const refMap = {}; // reference -> Array of lead IDs
        leads.forEach(l => {
            const ref = l.listing?.reference || l.project?.reference;
            if (ref) {
                if (!refMap[ref]) refMap[ref] = [];
                refMap[ref].push(String(l.id));
            }
        });

        // Load JSON
        if (!fs.existsSync(JSON_FILE)) {
            console.error('JSON file not found.');
            return;
        }
        const pfData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));

        // Update counts
        let updatedCount = 0;
        pfData.forEach(item => {
            const matchedLeads = refMap[item.Reference] || [];
            item.Leads = matchedLeads.length;
            item.LeadsIds = matchedLeads;
            if (matchedLeads.length > 0) updatedCount++;
        });

        // Save back
        fs.writeFileSync(JSON_FILE, JSON.stringify(pfData, null, 2));
        console.log(`SUCCESS: Updated ${updatedCount} listings with lead data.`);
        
        // Print top 5 for verification
        console.log('Top matched listings:');
        console.table(pfData.filter(i => i.Leads > 0).slice(0, 5).map(i => ({ Ref: i.Ref, Leads: i.Leads })));

    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

updateJsonWithLeads();
