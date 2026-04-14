import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE
});

async function checkPhones() {
    console.log('--- PF LEADS PHONES ---');
    const q1 = `SELECT customer_phone, count(*) as cnt FROM \`crypto-world-epta.foryou_analytics.pf_leads_raw\` WHERE customer_phone IS NOT NULL GROUP BY 1 LIMIT 5`;
    const [pfRows] = await bq.query(q1);
    console.table(pfRows);

    console.log('\n--- AMO CRM PHONES ---');
    const q2 = `SELECT phone, count(*) as cnt FROM \`crypto-world-epta.foryou_analytics.amo_lead_phones\` WHERE phone IS NOT NULL GROUP BY 1 LIMIT 5`;
    const [amoRows] = await bq.query(q2);
    console.table(amoRows);

    console.log('\n--- OVERLAP CHECK ---');
    const q3 = `
    SELECT 
        p.customer_phone as pf_phone, 
        a.phone as amo_phone,
        p.id as pf_lead_id,
        a.lead_id as amo_lead_id
    FROM \`crypto-world-epta.foryou_analytics.pf_leads_raw\` p
    JOIN \`crypto-world-epta.foryou_analytics.amo_lead_phones\` a 
      ON REPLACE(REPLACE(REPLACE(p.customer_phone, ' ', ''), '+', ''), '-', '') = a.phone
    LIMIT 10
    `;
    const [overlap] = await bq.query(q3);
    console.log(`Found ${overlap.length} direct matches by phone in sample.`);
    console.table(overlap);
}

checkPhones().catch(console.error);
