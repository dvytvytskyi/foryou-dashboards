import { BigQuery } from '@google-cloud/bigquery';
import fs from 'fs';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function findMatchedLeadInAmo() {
    // 1. Find a matched lead from BQ
    const q = `SELECT crm_lead_id FROM \`${PROJECT_ID}.${DATASET_ID}.pf_efficacy_master\` WHERE crm_lead_id IS NOT NULL LIMIT 1`;
    const [rows] = await bq.query(q);
    if (rows.length === 0) {
        console.log('No matched leads found in BQ.');
        return;
    }
    const crmLeadId = rows[0].crm_lead_id;
    console.log(`Checking matched Lead ID: ${crmLeadId}`);

    // 2. Fetch full data from AmoCRM
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    const domain = 'reforyou.amocrm.ru';
    const res = await fetch(`https://${domain}/api/v4/leads/${crmLeadId}`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const leadData = await res.json();
    
    console.log('--- CUSTOM FIELDS ---');
    leadData.custom_fields_values?.forEach(cf => {
        console.log(`${cf.field_name} (ID: ${cf.field_id}): ${cf.values[0].value}`);
    });
}

findMatchedLeadInAmo().catch(console.error);
