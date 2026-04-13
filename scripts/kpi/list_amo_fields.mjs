import fs from 'fs';
import path from 'path';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = 'reforyou.amocrm.ru';

async function listFields() {
    console.log('--- LISTING CUSTOM FIELDS IN AMOCRM ---');
    if (!fs.existsSync(AMO_TOKENS_FILE)) return;
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    const res = await fetch(`https://${domain}/api/v4/leads/custom_fields`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    if (!res.ok) {
        console.error('Failed to fetch lead fields');
        return;
    }

    const data = await res.json();
    const fields = data._embedded?.custom_fields || [];
    fields.forEach(f => {
        let enumStr = '';
        if (f.enums) {
            enumStr = ' [Choices: ' + f.enums.map(e => `${e.value} (ID: ${e.id})`).join(', ') + ']';
        }
        console.log(`- ${f.name} (ID: ${f.id}, Type: ${f.type})${enumStr}`);
    });
}

listFields().catch(console.error);
