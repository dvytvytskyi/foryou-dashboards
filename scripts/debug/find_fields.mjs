import fetch from 'node-fetch';
import fs from 'fs';

async function listAllFields() {
    const tokens = JSON.parse(fs.readFileSync('secrets/amo_tokens.json', 'utf8'));
    const domain = 'reforyou';

    console.log('--- Fetching All Lead Field Names ---');

    const res = await fetch(`https://${domain}.amocrm.ru/api/v4/leads/custom_fields`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const data = await res.json();
    if (data._embedded && data._embedded.custom_fields) {
        data._embedded.custom_fields.forEach(f => {
            if (f.name.toLowerCase().includes('доход') || f.name.toLowerCase().includes('компа') || f.name.toLowerCase().includes('чист')) {
                console.log(`${f.id}: ${f.name}`);
            }
        });
    }
}

listAllFields().catch(console.error);
