import fs from 'fs';
import path from 'path';

const AMO_DOMAIN = 'reforyou.amocrm.ru';
const AMO_TOKENS_FILE = path.join(process.cwd(), 'secrets/amo_tokens.json');

async function checkPipelines() {
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    const url = `https://${AMO_DOMAIN}/api/v4/leads/pipelines`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${tokens.access_token}` } });
    const data = await res.json();
    
    (data._embedded?.pipelines || []).forEach(p => {
        console.log(`Pipeline: ${p.name} (ID: ${p.id})`);
        p._embedded?.statuses?.forEach(s => {
            console.log(`  - Status: ${s.name} (ID: ${s.id})`);
        });
    });
}

checkPipelines();
