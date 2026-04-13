import fs from 'fs';
import path from 'path';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = 'reforyou.amocrm.ru';

async function listPipelineLossReasons() {
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    const res = await fetch(`https://${domain}/api/v4/leads/pipelines/8696950`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    const data = await res.json();
    const statuses = data._embedded?.statuses || [];
    const lostStatus = statuses.find(s => s.id === 143);
    
    // Actually, v4 loss reasons are global or by pipeline?
    // Let's try to find reasons for this pipeline specifically.
    console.log('Fetching loss reasons...');
    // Some accounts have global reasons, others per pipeline.
    
    // We already saw global ones. Let's list status IDs just in case.
    statuses.forEach(s => console.log(`- ${s.name} (ID: ${s.id})`));
}

listPipelineLossReasons().catch(console.error);
