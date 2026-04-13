import fs from 'fs';
import path from 'path';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = 'reforyou.amocrm.ru';

async function checkParsingInfo() {
    console.log(`--- CHECKING PARSING_INFO_FIELD_ID (1462131) ---`);
    if (!fs.existsSync(AMO_TOKENS_FILE)) return;
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    // Fetch some PF leads
    const res = await fetch(`https://${domain}/api/v4/leads?limit=100&order[created_at]=desc`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const data = await res.json();
    const leads = data._embedded?.leads || [];

    for (const lead of leads) {
        const fullRes = await fetch(`https://${domain}/api/v4/leads/${lead.id}`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        const fullData = await fullRes.json();
        const pf = fullData.custom_fields_values?.find(f => f.field_id === 703131 && f.values[0].value.includes('Property'));
        if (pf) {
            const parsingField = fullData.custom_fields_values?.find(f => f.field_id === 1462131);
            if (parsingField) {
                console.log(`Lead ${lead.id}: Parsing Info: ${parsingField.values[0].value}`);
            }
        }
    }
}

checkParsingInfo().catch(console.error);
