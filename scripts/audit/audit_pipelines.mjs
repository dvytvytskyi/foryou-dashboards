
import fs from 'fs';
import path from 'path';

/**
 * PIPELINE AUDITOR (v1.0)
 * To identify stage IDs and names for the Historical Funnel.
 */

const AMO_TOKENS_FILE = path.join(process.cwd(), 'secrets/amo_tokens.json');
const AMO_DOMAIN = 'reforyou.amocrm.ru';

async function auditPipelines() {
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    
    console.log('Fetching Pipelines & Statuses...');
    const res = await fetch(`https://${AMO_DOMAIN}/api/v4/leads/pipelines`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const data = await res.json();
    
    const pipelines = data?._embedded?.pipelines || [];
    pipelines.forEach(p => {
        console.log(`\nPipeline: ${p.name} (ID: ${p.id})`);
        p._embedded?.statuses?.forEach(s => {
            console.log(`  - Stage: ${s.name} (ID: ${s.id})`);
        });
    });
}

auditPipelines().catch(console.error);
