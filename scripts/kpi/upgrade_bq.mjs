import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'broker_kpi_targets';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function upgradeSchema() {
    console.log('Replacing table with correct DATE schema...');
    
    // Delete existing table to reset schema cleanly
    try {
        await bq.dataset(DATASET_ID).table(TABLE_ID).delete();
        console.log('Old table deleted.');
    } catch (e) {
        console.log('Table did not exist, skipping delete.');
    }

    const schema = [
        { name: 'month_key', type: 'DATE' },
        { name: 'broker_name', type: 'STRING' },
        { name: 'target_leads', type: 'INTEGER' },
        { name: 'target_deals', type: 'INTEGER' },
        { name: 'target_revenue', type: 'FLOAT' },
        { name: 'crm_quality', type: 'STRING' },
        { name: 'updated_at', type: 'TIMESTAMP' }
    ];

    await bq.dataset(DATASET_ID).createTable(TABLE_ID, { schema });
    console.log('New table created with DATE schema. SUCCESS.');
}

upgradeSchema().catch(console.error);
