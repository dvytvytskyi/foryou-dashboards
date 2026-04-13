import fs from 'fs';
import path from 'path';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = 'reforyou.amocrm.ru';

async function diagnoseAmo() {
    console.log('--- AMO_CRM DIAGNOSTICS ---');
    if (!fs.existsSync(AMO_TOKENS_FILE)) {
        console.error('ERROR: tokens.json NOT FOUND');
        return;
    }
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    console.log('Token starts with:', tokens.access_token?.substring(0, 15) + '...');

    const res = await fetch(`https://${domain}/api/v4/account`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    console.log('HTTP Status:', res.status);
    
    if (res.ok) {
        const data = await res.json();
        console.log('SUCCESS! Account Name:', data.name);
        console.log('Account ID:', data.id);
    } else {
        const errorText = await res.text();
        console.error('ERROR BODY:', errorText);
    }
}

diagnoseAmo().catch(console.error);
