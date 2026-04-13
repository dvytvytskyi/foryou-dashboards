import fs from 'fs';
import path from 'path';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = 'reforyou.amocrm.ru';

async function scanStatuses() {
    console.log('--- SCANNING PIPELINE STATUSES ---');
    if (!fs.existsSync(AMO_TOKENS_FILE)) return;
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    // Get the Real Estate pipeline (ID: 8696950)
    const res = await fetch(`https://${domain}/api/v4/leads/pipelines/8696950`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    if (!res.ok) {
        console.error('Failed to fetch pipeline details');
        return;
    }

    const data = await res.json();
    const statuses = data._embedded?.statuses || [];
    console.log('Statuses in Real Estate Pipeline:');
    statuses.forEach((s) => console.log(`- ${s.name} (ID: ${s.id})`));
}

scanStatuses().catch(console.error);
