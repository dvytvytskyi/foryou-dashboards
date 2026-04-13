import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE,
    location: 'europe-central2'
});

async function createMappingTable() {
    console.log('--- CREATING VISITOR MAPPING TABLE (M9) ---');
    const tableId = 'marketing_visitor_mapping';
    const dataset = bq.dataset(DATASET_ID);
    const table = dataset.table(tableId);

    const schema = {
        fields: [
            { name: 'foryou_cid', type: 'STRING' }, // UUID of browser
            { name: 'lead_id', type: 'INT64' },     // amoCRM Lead ID
            { name: 'phone', type: 'STRING' },       // Client Phone (for reference)
            { name: 'first_seen', type: 'TIMESTAMP' },
            { name: 'last_seen', type: 'TIMESTAMP' },
            { name: 'last_page_url', type: 'STRING' }
        ]
    };

    const [exists] = await table.exists();
    if (!exists) {
        await dataset.createTable(tableId, { schema, location: 'europe-central2' });
        console.log('SUCCESS: marketing_visitor_mapping created.');
    } else {
        console.log('Table already exists.');
    }
}

createMappingTable().catch(console.error);
