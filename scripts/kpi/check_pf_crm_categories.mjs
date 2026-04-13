import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function checkTags() {
    // Note: 'tags' is NOT in the schema we saw. Wait, let's check the schema again.
    // The previous error said "Unrecognized name: tags".
    // So 'tags' is NOT in the table.
    
    // How about and custom fields?
    // Let's check 'client_type_label' or 'utm_campaign'.
    const q = `
        SELECT client_type_label, COUNT(*) as cnt 
        FROM \`${PROJECT_ID}.${DATASET_ID}.amo_channel_leads_raw\` 
        WHERE source_label LIKE '%Property%' 
        GROUP BY 1
    `;
    const [rows] = await bq.query(q);
    console.table(rows);
}

checkTags().catch(console.error);
