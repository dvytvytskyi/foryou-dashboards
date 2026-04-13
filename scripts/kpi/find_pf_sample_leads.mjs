import fs from 'fs';
import path from 'path';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = 'reforyou.amocrm.ru';

async function findPFLeads() {
    console.log('--- FINDING PROPERTY FINDER LEADS ---');
    if (!fs.existsSync(AMO_TOKENS_FILE)) return;
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    // Try to find leads created in last 90 days
    const res = await fetch(`https://${domain}/api/v4/leads?limit=100&order[created_at]=desc`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    if (!res.ok) {
        console.error('Failed to fetch leads:', res.status);
        return;
    }

    const data = await res.json();
    const leads = data._embedded?.leads || [];
    
    for (const lead of leads) {
        const fullRes = await fetch(`https://${domain}/api/v4/leads/${lead.id}`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        const fullData = await fullRes.json();
        
        const sourceField = fullData.custom_fields_values?.find(f => f.field_id === 703131 || f.field_name === 'Источник');
        if (sourceField?.values[0].value.toLowerCase().includes('property')) {
            console.log(`\nLEAD ID: ${lead.id} | Name: ${fullData.name}`);
            fullData.custom_fields_values?.forEach(cf => {
                console.log(`  - ${cf.field_name} (ID: ${cf.field_id}): ${cf.values[0].value}`);
            });
        }
    }
}

findPFLeads().catch(console.error);
