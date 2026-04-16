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

async function inspectLeads() {
    console.log('--- INSPECTING LEADS ---');
    try {
        const token = await getPFToken();
        const res = await fetch(`https://atlas.propertyfinder.com/v1/leads?perPage=50`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        const data = await res.json();
        const leads = data.data || [];
        
        leads.forEach(l => {
            console.log(`ID: ${l.id} | Type: ${l.entityType} | Dist: ${l.distributionType} | Time: ${l.createdAt}`);
            if (l.project) console.log(`  Project ID: ${l.project.id}`);
        });
    } catch (e) {
        console.error('ERROR:', e);
    }
}

inspectLeads();
