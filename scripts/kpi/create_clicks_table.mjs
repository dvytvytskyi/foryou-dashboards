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

async function createClicksTable() {
    console.log('--- CREATING MARKETING CLICKS TABLE (WA BRIDGE) ---');
    const tableId = 'marketing_clicks_raw';
    const dataset = bq.dataset(DATASET_ID);
    const table = dataset.table(tableId);

    const schema = {
        fields: [
            { name: 'click_id', type: 'STRING' },
            { name: 'click_time', type: 'TIMESTAMP' },
            { name: 'utm_source', type: 'STRING' },
            { name: 'utm_campaign', type: 'STRING' },
            { name: 'utm_medium', type: 'STRING' },
            { name: 'utm_content', type: 'STRING' },
            { name: 'ip_address', type: 'STRING' },
            { name: 'country', type: 'STRING' },
            { name: 'user_agent', type: 'STRING' },
            { name: 'target_wa_number', type: 'STRING' },
            { name: 'is_converted', type: 'BOOLEAN' } // Will be updated later
        ]
    };

    const [exists] = await table.exists();
    if (!exists) {
        await dataset.createTable(tableId, { schema, location: 'europe-central2' });
        console.log('SUCCESS: marketing_clicks_raw created.');
    } else {
        console.log('Table already exists.');
    }
}

createClicksTable().catch(console.error);
