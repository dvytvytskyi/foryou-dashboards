import fs from 'fs';
import path from 'path';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = 'reforyou.amocrm.ru';

async function inspectLeadsBatch(ids) {
    if (!fs.existsSync(AMO_TOKENS_FILE)) return;
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    for (const id of ids) {
        console.log(`\n--- LEAD ${id} ---`);
        const res = await fetch(`https://${domain}/api/v4/leads/${id}`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        if (res.ok) {
            const data = await res.json();
            data.custom_fields_values?.forEach(cf => {
                if (cf.field_name.includes('отказ') || cf.field_name.includes('причина') || cf.field_name.includes('Другое')) {
                    console.log(`- ${cf.field_name}: ${cf.values[0].value}`);
                }
            });
        }
    }
}

// These IDs were found in /tmp/loss_reasons.json earlier
inspectLeadsBatch([32777423, 32774763, 32777833]).catch(console.error);
