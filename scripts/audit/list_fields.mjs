import fetch from 'node-fetch';
import fs from 'fs';

async function listAllFields() {
    console.log('Fetching fields...');
    const tokens = JSON.parse(fs.readFileSync('secrets/amo_tokens.json', 'utf8'));
    const domain = 'reforyou';

    const res = await fetch(`https://${domain}.amocrm.ru/api/v4/leads/custom_fields?limit=250`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    console.log('Status:', res.status);
    if (!res.ok) {
        const err = await res.text();
        console.error('Error body:', err);
        return;
    }
    const data = await res.json();
    if (data._embedded && data._embedded.custom_fields) {
        data._embedded.custom_fields.forEach(f => console.log(`${f.id}: ${f.name}`));
    } else {
        console.log('No custom fields found or empty response.');
    }
}

listAllFields().catch(console.error);
