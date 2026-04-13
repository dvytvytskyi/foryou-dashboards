import fs from 'fs';
import path from 'path';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = 'reforyou.amocrm.ru';

async function searchAmoGlobal(query) {
    console.log(`--- SEARCHING AMOCRM FOR "${query}" ---`);
    if (!fs.existsSync(AMO_TOKENS_FILE)) return;
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    // Try to search via query parameter
    const res = await fetch(`https://${domain}/api/v4/leads?query=${query}`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    if (res.status === 204) {
        console.log('No leads found with this query.');
        return;
    }

    if (!res.ok) {
        console.error('Failed to search leads:', res.status);
        return;
    }

    const data = await res.json();
    const leads = data._embedded?.leads || [];
    
    for (const lead of leads) {
        console.log(`\nFOUND LEAD ID: ${lead.id}`);
        console.log(`Name: ${lead.name}`);
        
        // Fetch full data
        const fullRes = await fetch(`https://${domain}/api/v4/leads/${lead.id}`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        const fullData = await fullRes.json();
        
        fullData.custom_fields_values?.forEach(cf => {
            const hasIt = JSON.stringify(cf.values).includes(query);
            if (hasIt) {
                console.log(`  - MATCH in Field: ${cf.field_name} (ID: ${cf.field_id}): ${cf.values[0].value}`);
            }
        });
    }
}

searchAmoGlobal('9963224').catch(console.error);
