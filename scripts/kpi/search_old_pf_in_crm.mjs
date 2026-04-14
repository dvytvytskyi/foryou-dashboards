import fs from 'fs';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const domain = 'reforyou.amocrm.ru';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE
});

async function checkOldPFLeads() {
    console.log('--- CHECKING OLD PF LEADS (MARCH) IN CRM ---');
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    const [pfLeads] = await bq.query(`
        SELECT customer_phone, customer_name, created_at
        FROM \`crypto-world-epta.foryou_analytics.pf_leads_raw\` 
        WHERE pf_category != 'project' AND created_at < '2026-03-25'
        ORDER BY created_at DESC 
        LIMIT 10
    `);

    for (const lead of pfLeads) {
        const last9 = lead.customer_phone?.replace(/\D/g, '').slice(-9);
        if (!last9) continue;

        console.log(`Searching for March Lead: ${lead.customer_name} (...${last9}) - ${lead.created_at.value}`);
        const searchRes = await fetch(`https://${domain}/api/v4/contacts?query=${last9}`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });

        if (searchRes.ok && searchRes.status !== 204) {
            console.log(`  [V] FOUND!`);
        } else {
            console.log(`  [X] NOT FOUND`);
        }
        await new Promise(r => setTimeout(r, 400));
    }
}

checkOldPFLeads().catch(console.error);
