import { BigQuery } from '@google-cloud/bigquery';
import fs from 'fs';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE,
    location: 'europe-central2'
});

async function syncWaAttribution() {
    console.log('--- SYNCING WHATSAPP ATTRIBUTION (CLICK ID MATCHING) ---');
    
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    const domain = 'reforyou.amocrm.ru';

    // 1. Fetch recent leads from amoCRM that have incoming WA messages
    // (Assuming Wazzup puts first message into a specific field or note)
    // For this prototype, I search for leads created in the last 24h
    const res = await fetch(`https://${domain}/api/v4/leads?limit=50&order[created_at]=desc&with=contacts`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    if (!res.ok) return;
    const data = await res.json();
    const leads = data._embedded?.leads || [];

    for (const lead of leads) {
        // 2. We need to find the Click ID in the lead's name, notes, or a specific Wazzup field
        // Usually, Wazzup leads have the incoming text in a Note or specific field.
        // Let's assume we check the lead's 'name' or a comment (for testing)
        // In production, we'd query /api/v4/leads/{id}/notes
        
        const noteRes = await fetch(`https://${domain}/api/v4/leads/${lead.id}/notes`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        const noteData = await noteRes.json();
        const notes = noteData._embedded?.notes || [];
        
        let foundClickId = null;
        for (const note of notes) {
            const text = note.params?.text || '';
            const match = text.match(/\[ID: (C-[A-Z0-9]+)\]/);
            if (match) {
                foundClickId = match[1];
                break;
            }
        }

        if (foundClickId) {
            console.log(`Matched Lead ${lead.id} with Click ID: ${foundClickId}`);
            
            // 3. Find Click Info in BigQuery
            const [rows] = await bq.query({
                query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.marketing_clicks_raw\` WHERE click_id = @id LIMIT 1`,
                params: { id: foundClickId }
            });

            if (rows.length > 0) {
                const click = rows[0];
                console.log(`Found Source for Lead ${lead.id}: ${click.utm_source} / ${click.utm_campaign}`);

                // 4. Update Lead in amoCRM with UTMs
                await fetch(`https://${domain}/api/v4/leads/${lead.id}`, {
                    method: 'PATCH',
                    headers: { 
                        'Authorization': `Bearer ${tokens.access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        custom_fields_values: [
                            { field_id: 683939, values: [{ value: click.utm_source }] }, // UTM Source
                            { field_id: 683937, values: [{ value: click.utm_campaign }] }, // UTM Campaign
                            { field_id: 683935, values: [{ value: click.utm_medium }] }, // UTM Medium
                            { field_id: 683933, values: [{ value: click.utm_content }] } // UTM Content
                        ]
                    })
                });
                console.log(`SUCCESS: Lead ${lead.id} attributed!`);
            }
        }
    }
}

syncWaAttribution().catch(console.error);
