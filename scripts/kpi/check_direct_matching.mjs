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

async function checkDirectMatching() {
    console.log('--- STARTING DIRECT CRM MATCHING CHECK ---');
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    // 1. Fetch latest leads from PF (from BigQuery, as they are fresh)
    const [pfLeads] = await bq.query(`
        SELECT customer_phone, customer_name, created_at 
        FROM \`crypto-world-epta.foryou_analytics.pf_leads_raw\` 
        WHERE pf_category != 'project'
        ORDER BY created_at DESC 
        LIMIT 100
    `);
    console.log(`Analyzing last ${pfLeads.length} PF leads...`);

    // 2. Fetch latest leads from AmoCRM API
    console.log('Fetching latest leads from AmoCRM API...');
    const amoRes = await fetch(`https://${domain}/api/v4/leads?limit=50&order[created_at]=desc&with=contacts`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    
    if (!amoRes.ok) {
        throw new Error(`AmoCRM API error: ${amoRes.status} ${await amoRes.text()}`);
    }
    
    const amoData = await amoRes.json();
    const amoLeads = amoData._embedded?.leads || [];
    console.log(`Fetched ${amoLeads.length} latest leads from CRM.`);

    // 3. For each CRM lead, fetch its contact's phone
    let matchedCount = 0;
    const pfPhones = new Set(pfLeads.map(l => l.customer_phone?.replace(/\D/g, '').slice(-9)));

    for (const lead of amoLeads) {
        const contactId = lead._embedded?.contacts?.[0]?.id;
        if (!contactId) continue;

        const contactRes = await fetch(`https://${domain}/api/v4/contacts/${contactId}`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        if (!contactRes.ok) continue;
        const contact = await contactRes.json();
        const phoneField = contact.custom_fields_values?.find(f => f.field_code === 'PHONE');
        if (phoneField) {
            for (const v of phoneField.values) {
                const cleanPhone = v.value.replace(/\D/g, '').slice(-9);
                if (pfPhones.has(cleanPhone)) {
                    console.log(` MATCH FOUND! Lead "${lead.name}" (${lead.id}) matches PF phone ending in ...${cleanPhone}`);
                    matchedCount++;
                }
            }
        }
    }

    console.log('------------------------------------------');
    console.log(`Sample Matching Result: ${matchedCount} matches found in the latest 50 CRM leads.`);
}

checkDirectMatching().catch(console.error);
