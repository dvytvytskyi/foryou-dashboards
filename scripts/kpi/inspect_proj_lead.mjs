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

async function inspectProjectLead() {
    try {
        const token = await getPFToken();
        const res = await fetch(`https://atlas.propertyfinder.com/v1/leads?perPage=1&page=1&entityType=project`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        const data = await res.json();
        console.log(JSON.stringify(data.data[0], null, 2));
    } catch (e) {
        console.error(e);
    }
}

inspectProjectLead();
