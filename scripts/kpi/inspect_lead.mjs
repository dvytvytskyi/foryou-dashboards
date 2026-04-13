import fs from 'fs';
import path from 'path';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = 'reforyou.amocrm.ru';

async function inspectLead(leadId) {
    console.log(`--- INSPECTING LEAD ${leadId} ---`);
    if (!fs.existsSync(AMO_TOKENS_FILE)) return;
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    const res = await fetch(`https://${domain}/api/v4/leads/${leadId}`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    if (res.ok) {
        const data = await res.json();
        console.log('Status ID:', data.status_id);
        console.log('Loss Reason ID:', data.loss_reason_id);
        console.log('Custom Fields:');
        data.custom_fields_values?.forEach(cf => {
            console.log(`- ${cf.field_name} (ID: ${cf.field_id}): ${cf.values[0].value}`);
        });
    } else {
        console.error('Failed to fetch lead:', res.status);
    }
}

inspectLead(32371415).catch(console.error);
