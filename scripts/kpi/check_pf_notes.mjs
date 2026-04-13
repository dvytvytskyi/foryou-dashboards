import fs from 'fs';
import path from 'path';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = 'reforyou.amocrm.ru';

async function checkNotes() {
    console.log(`--- CHECKING NOTES FOR PF LEADS ---`);
    if (!fs.existsSync(AMO_TOKENS_FILE)) return;
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    const res = await fetch(`https://${domain}/api/v4/leads?limit=50&order[created_at]=desc`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const data = await res.json();
    const leads = data._embedded?.leads || [];

    for (const lead of leads) {
        const fullRes = await fetch(`https://${domain}/api/v4/leads/${lead.id}`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        const fullData = await fullRes.json();
        const isPF = fullData.custom_fields_values?.find(f => f.field_id === 703131 && f.values[0].value.toLowerCase().includes('property'));
        
        if (isPF) {
            console.log(`\nLead ${lead.id}:`);
            const notesRes = await fetch(`https://${domain}/api/v4/leads/${lead.id}/notes`, {
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            });
            if (notesRes.status === 204) {
                console.log('  No notes.');
                continue;
            }
            const notesData = await notesRes.json();
            notesData._embedded?.notes?.forEach(n => {
                if (n.params?.text) {
                    console.log(`  Note Text: ${n.params.text.substring(0, 100)}...`);
                }
            });
        }
    }
}

checkNotes().catch(console.error);
