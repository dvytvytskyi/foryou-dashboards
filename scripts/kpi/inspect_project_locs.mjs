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

async function inspectProjectLocations() {
    try {
        const token = await getPFToken();
        const jsonPath = path.resolve('./pf_projects_report.json');
        const projects = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).slice(0, 10);
        
        for (const p of projects) {
            const res = await fetch(`https://atlas.propertyfinder.com/v1/projects/${p.ProjectId}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            const data = await res.json();
            console.log(`Project: ${p.Title} | ID: ${p.ProjectId}`);
            console.log(`Location:`, JSON.stringify(data.location, null, 2));
            console.log('---');
        }
    } catch (e) {
        console.error(e);
    }
}

inspectProjectLocations();
