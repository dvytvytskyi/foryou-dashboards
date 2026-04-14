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

async function checkPFTocrm() {
    console.log('--- CHECKING IF RECENT PF LEADS EXIST IN CRM ---');
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    // 1. Fetch latest 20 PF leads
    const [pfLeads] = await bq.query(`
        SELECT customer_phone, customer_name, created_at, listing_ref
        FROM \`crypto-world-epta.foryou_analytics.pf_leads_raw\` 
        WHERE pf_category != 'project'
        ORDER BY created_at DESC 
        LIMIT 20
    `);

    for (const lead of pfLeads) {
        const phone = lead.customer_phone?.replace(/\D/g, '');
        if (!phone) continue;

        console.log(`Searching for PF Lead: ${lead.customer_name} (${phone}) - ${lead.created_at.value}`);
        
        // Search contact by phone in AmoCRM
        const searchRes = await fetch(`https://${domain}/api/v4/contacts?query=${phone}`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });

        if (searchRes.status === 204) {
            console.log(`  [X] NOT FOUND in CRM`);
        } else if (searchRes.ok) {
            const data = await searchRes.json();
            const contacts = data._embedded?.contacts || [];
            if (contacts.length > 0) {
                console.log(`  [V] FOUND! Contact ID: ${contacts[0].id}`);
            } else {
                console.log(`  [X] NOT FOUND in CRM`);
            }
        } else {
            console.log(`  [!] Error searching CRM: ${searchRes.status}`);
        }
        await new Promise(r => setTimeout(r, 300)); // Delay to avoid rate limit
    }
}

checkPFTocrm().catch(console.error);
