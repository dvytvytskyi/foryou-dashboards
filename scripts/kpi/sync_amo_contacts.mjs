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

async function syncAmoContacts() {
    console.log('--- SYNCING AMO CONTACTS TO BIGQUERY ---');
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    // Fetch Contacts with Leads
    // GET /api/v4/contacts?with=leads&limit=250
    let page = 1;
    let allMappings = [];

    while (true) { 
        console.log(`Fetching page ${page}...`);
        const res = await fetch(`https://${domain}/api/v4/contacts?with=leads&limit=250&page=${page}`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });

        if (res.status === 204) break;
        if (!res.ok) {
            const err = await res.text();
            console.error(`Error on page ${page}: ${err}`);
            break;
        }

        const data = await res.json();
        const contacts = data._embedded?.contacts || [];
        if (contacts.length === 0) break;

        contacts.forEach(c => {
            const phoneField = c.custom_fields_values?.find(cf => cf.field_code === 'PHONE');
            if (phoneField && c._embedded?.leads) {
                const phones = phoneField.values.map(v => v.value.replace(/\D/g, '')); // Clean phone
                c._embedded.leads.forEach(l => {
                    phones.forEach(p => {
                        allMappings.push({
                            lead_id: l.id,
                            contact_id: c.id,
                            phone: p,
                            updated_at: new Date().toISOString()
                        });
                    });
                });
            }
        });
        page++;
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`Total mappings extracted: ${allMappings.length}`);
    if (allMappings.length === 0) return;

    // Save to BQ
    const tableId = 'amo_lead_phones';
    const dataset = bq.dataset('foryou_analytics');
    const table = dataset.table(tableId);

    const [exists] = await table.exists();
    if (!exists) {
        await dataset.createTable(tableId, {
            schema: [
                { name: 'lead_id', type: 'INT64' },
                { name: 'contact_id', type: 'INT64' },
                { name: 'phone', type: 'STRING' },
                { name: 'updated_at', type: 'TIMESTAMP' }
            ]
        });
    }

    const json = allMappings.map(m => JSON.stringify(m)).join('\n');
    fs.writeFileSync('/tmp/amo_phones.json', json);

    await table.load('/tmp/amo_phones.json', {
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        writeDisposition: 'WRITE_TRUNCATE'
    });
    console.log('SUCCESS: AMO Phones/Leads mapping synced.');
}

syncAmoContacts().catch(console.error);
