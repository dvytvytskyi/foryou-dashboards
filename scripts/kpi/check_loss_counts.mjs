import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function checkLossReasonIds() {
    console.log('--- FREQUENCY OF LOSS REASON IDs ---');
    const query = `
        SELECT loss_reason_id, COUNT(*) as count 
        FROM \`${PROJECT_ID}.${DATASET_ID}.leads_loss_reasons\`
        GROUP BY loss_reason_id
        ORDER BY count DESC
        LIMIT 20
    `;
    const [rows] = await bq.query(query);
    rows.forEach(r => {
        console.log(`ID: ${r.loss_reason_id}, Count: ${r.count}`);
    });
}

checkLossReasonIds().catch(console.error);
