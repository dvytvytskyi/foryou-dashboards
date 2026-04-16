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

async function searchLocationEn() {
    try {
        const token = await getPFToken();
        const locId = '105'; 
        const res2 = await fetch(`https://atlas.propertyfinder.com/v1/locations?filter[id]=${locId}`, {
            headers: { 
                'Authorization': `Bearer ${token}`, 
                'Accept': 'application/json',
                'Accept-Language': 'en'
            }
        });
        const data2 = await res2.json();
        console.log('Filter by ID result (EN):', JSON.stringify(data2, null, 2));
    } catch (e) {
        console.error(e);
    }
}

searchLocationEn();
