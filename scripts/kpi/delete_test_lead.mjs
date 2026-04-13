import fs from 'fs';
import path from 'path';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = 'reforyou.amocrm.ru';

async function deleteLead(leadId) {
    console.log(`--- DELETING LEAD ${leadId} FROM AMOCRM ---`);
    if (!fs.existsSync(AMO_TOKENS_FILE)) return;
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    // To delete a lead in amoCRM v4, we can move it to "status 143" (Lost) 
    // or use the delete endpoint (which is usually not public or restricted).
    // Actually, v4 has a delete endpoint: DELETE /api/v4/leads/{id}
    
    const res = await fetch(`https://${domain}/api/v4/leads/${leadId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    if (res.ok || res.status === 204) {
        console.log(`SUCCESS: Lead ${leadId} deleted.`);
    } else {
        const err = await res.text();
        console.error(`FAILED to delete lead ${leadId}:`, res.status, err);
    }
}

deleteLead(44297823).catch(console.error);
