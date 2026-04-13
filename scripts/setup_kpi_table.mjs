import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'broker_kpi_targets';
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function setupKpiTable() {
    console.log('--- Setting up KPI Table in BigQuery ---');
    
    const schema = [
        { name: 'month_key', type: 'STRING' }, // e.g. "2026-03"
        { name: 'broker_name', type: 'STRING' },
        { name: 'target_leads', type: 'INTEGER' },
        { name: 'target_deals', type: 'INTEGER' },
        { name: 'target_revenue', type: 'FLOAT' },
        { name: 'crm_quality', type: 'STRING' },
        { name: 'updated_at', type: 'TIMESTAMP' }
    ];

    try {
        const dataset = bq.dataset(DATASET_ID);
        const [table] = await dataset.table(TABLE_ID).get();
        console.log('Table already exists.');
    } catch (e) {
        console.log('Table not found. Creating...');
        await bq.dataset(DATASET_ID).createTable(TABLE_ID, { schema });
        console.log('Table created successfully.');
    }
}

setupKpiTable().catch(console.error);
