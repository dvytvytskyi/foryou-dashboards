import fs from 'fs';
import path from 'path';

async function checkLeadsCustomFields() {
    const tokens = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'secrets/amo_tokens.json'), 'utf8'));
    const url = `https://reforyou.amocrm.ru/api/v4/leads/pipelines`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${tokens.access_token}` } });
    const data = await res.json();
    console.log('--- PIPELINES AND STAGES ---');
    console.log(JSON.stringify(data, null, 2));

    const fieldsUrl = `https://reforyou.amocrm.ru/api/v4/leads/custom_fields`;
    const resFields = await fetch(fieldsUrl, { headers: { 'Authorization': `Bearer ${tokens.access_token}` } });
    const fieldsData = await resFields.json();
    console.log('--- CUSTOM FIELDS ---');
    const dateFields = (fieldsData?._embedded?.custom_fields || []).filter(f => f.type === 'date' || f.name.toLowerCase().includes('дата'));
    console.log(dateFields.map(f => ({ id: f.id, name: f.name })));
}

checkLeadsCustomFields();
