import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function testNameMatch() {
    const q = `
        WITH pf AS (
            SELECT 
                customer_name, 
                customer_phone,
                listing_ref,
                created_at as pf_at
            FROM \`${PROJECT_ID}.${DATASET_ID}.pf_leads_raw\`
            WHERE customer_name IS NOT NULL
        ),
        amo AS (
            SELECT 
                lead_id, 
                name, 
                created_at as crm_at 
            FROM \`${PROJECT_ID}.${DATASET_ID}.amo_channel_leads_raw\`
            WHERE source_label LIKE '%Property%'
        )
        SELECT 
            pf.customer_name, 
            amo.name as amo_name, 
            pf.listing_ref, 
            amo.lead_id
        FROM pf 
        JOIN amo ON (LOWER(amo.name) LIKE CONCAT('%', LOWER(pf.customer_name), '%'))
        WHERE ABS(TIMESTAMP_DIFF(pf.pf_at, amo.crm_at, MINUTE)) < 60
        LIMIT 20
    `;
    const [rows] = await bq.query(q);
    console.table(rows);
}

testNameMatch().catch(console.error);
