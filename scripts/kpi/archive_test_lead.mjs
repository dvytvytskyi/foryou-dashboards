import fs from 'fs';
import path from 'path';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = 'reforyou.amocrm.ru';

async function archiveLead(leadId) {
    console.log(`--- ARCHIVING LEAD ${leadId} (Moving to status 143) ---`);
    if (!fs.existsSync(AMO_TOKENS_FILE)) return;
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    const res = await fetch(`https://${domain}/api/v4/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 
            'Authorization': `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
            status_id: 143 // Closed-Lost
        })
    });

    if (res.ok) {
        console.log(`SUCCESS: Lead ${leadId} moved to Closed-Lost.`);
    } else {
        const err = await res.text();
        console.error(`FAILED to archive lead ${leadId}:`, res.status, err);
    }
}

archiveLead(44297823).catch(console.error);
