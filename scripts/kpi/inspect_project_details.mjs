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

async function inspectProject() {
    try {
        const token = await getPFToken();
        const projectId = 'b027cd57-3ea9-4771-84f6-474d83534e39'; // Swiss Residences
        const res = await fetch(`https://atlas.propertyfinder.com/v1/projects/${projectId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

inspectProject();
