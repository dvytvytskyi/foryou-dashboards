import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function checkCRMCounts() {
    const q1 = `SELECT source_label, COUNT(*) as cnt 
                FROM \`${PROJECT_ID}.${DATASET_ID}.amo_channel_leads_raw\` 
                WHERE source_label LIKE '%Property%' 
                GROUP BY 1`;
    const [rows1] = await bq.query(q1);
    console.log('--- PROPERY FINDER LEADS IN amo_channel_leads_raw ---');
    console.table(rows1);

    const q2 = `SELECT status_id, COUNT(*) as cnt 
                FROM \`${PROJECT_ID}.${DATASET_ID}.amo_channel_leads_raw\` 
                WHERE source_label LIKE '%Property%' 
                GROUP BY 1`;
    const [rows2] = await bq.query(q2);
    console.log('\n--- STATUS IDS FOR PF LEADS ---');
    console.table(rows2);

    const q3 = `SELECT COUNT(*) as cnt FROM \`${PROJECT_ID}.${DATASET_ID}.pf_efficacy_master\``;
    const [rows3] = await bq.query(q3);
    console.log('\n--- TOTAL IN pf_efficacy_master ---');
    console.log(rows3[0].cnt);
}

checkCRMCounts().catch(console.error);
