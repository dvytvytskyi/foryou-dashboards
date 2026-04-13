import fs from 'fs';
import path from 'path';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = 'reforyou.amocrm.ru';

async function listLossReasons() {
    console.log('--- LISTING LOSS REASONS IN AMOCRM ---');
    if (!fs.existsSync(AMO_TOKENS_FILE)) return;
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    const res = await fetch(`https://${domain}/api/v4/leads/loss_reasons`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    if (!res.ok) {
        console.error('Failed to fetch loss reasons');
        return;
    }

    const data = await res.json();
    const reasons = data._embedded?.loss_reasons || [];
    reasons.forEach(r => {
        console.log(`- ${r.name} (ID: ${r.id})`);
    });
}

listLossReasons().catch(console.error);
