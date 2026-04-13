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

async function syncLossReasons() {
    console.log('--- SYNCING LOSS REASONS FOR RED LEADS ---');
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    // 1. Get RED Lead IDs from BigQuery
    const query = 'SELECT DISTINCT lead_id FROM `crypto-world-epta.foryou_analytics.red_leads_raw`';
    const [rows] = await bq.query(query);
    const redLeadIds = rows.map(r => r.lead_id);
    console.log(`Found ${redLeadIds.length} RED Lead IDs to check.`);

    // 2. Fetch Loss Reasons from amoCRM API for these IDs
    // We can fetch in batches or one by one (API v4 allows filter[id])
    const batchSize = 50;
    const lossResults = [];

    for (let i = 0; i < redLeadIds.length; i += batchSize) {
        const batch = redLeadIds.slice(i, i + batchSize);
        console.log(`Checking batch ${i/batchSize + 1}...`);
        
        try {
            const url = `https://${domain}/api/v4/leads?${batch.map(id => `filter[id][]=${id}`).join('&')}`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            });

            if (res.ok) {
                const data = await res.json();
                const leads = data._embedded?.leads || [];
                leads.forEach(l => {
                    const rejectionField = l.custom_fields_values?.find(cf => cf.field_id === 698409);
                    const reason = rejectionField?.values[0]?.value || null;
                    
                    if (l.status_id === 143) { // Lost
                        lossResults.push({
                            lead_id: l.id,
                            loss_reason_id: null,
                            loss_reason_name: reason,
                            updated_at: new Date().toISOString()
                        });
                    }
                });
            } else if (res.status === 204) {
                // No content, perfectly fine
            } else {
                console.error(`Error batch ${i}:`, res.status);
            }
        } catch (e) {
            console.error(`Fetch exception: ${e.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`Found ${lossResults.length} leads with loss reasons.`);
    if (lossResults.length === 0) return;

    // 3. Save to BigQuery
    const datasetId = 'foryou_analytics';
    const tableId = 'leads_loss_reasons';
    const dataset = bq.dataset(datasetId);
    const table = dataset.table(tableId);

    const [exists] = await table.exists();
    if (!exists) {
        await dataset.createTable(tableId, {
            schema: [
                { name: 'lead_id', type: 'INT64' },
                { name: 'loss_reason_id', type: 'INT64' },
                { name: 'loss_reason_name', type: 'STRING' },
                { name: 'updated_at', type: 'TIMESTAMP' }
            ]
        });
    } else {
        // Just in case, try to add column (BigQuery allows adding columns easily)
        try { await table.setMetadata({ schema: { fields: [
            { name: 'lead_id', type: 'INT64' },
            { name: 'loss_reason_id', type: 'INT64' },
            { name: 'loss_reason_name', type: 'STRING' },
            { name: 'updated_at', type: 'TIMESTAMP' }
        ] } }); } catch (e) {}
    }

    const resultsJson = lossResults.map(r => JSON.stringify(r)).join('\n');
    const tempFile = path.resolve('/tmp/loss_reasons.json');
    fs.writeFileSync(tempFile, resultsJson);

    await table.load(tempFile, {
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        writeDisposition: 'WRITE_TRUNCATE'
    });
    console.log('SUCCESS: Loss reasons synced to BigQuery.');
}

syncLossReasons().catch(console.error);
