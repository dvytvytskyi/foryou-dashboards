import fs from 'fs';
import path from 'path';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = 'reforyou.amocrm.ru';

async function listPipelines() {
    console.log('--- LISTING ALL PIPELINES ---');
    if (!fs.existsSync(AMO_TOKENS_FILE)) return;
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    const res = await fetch(`https://${domain}/api/v4/leads/pipelines`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    if (!res.ok) {
        console.error('Failed to fetch pipelines');
        return;
    }

    const data = await res.json();
    const pipelines = data._embedded?.pipelines || [];
    pipelines.forEach(p => {
        console.log(`- ${p.name} (ID: ${p.id})`);
    });
}

listPipelines().catch(console.error);
