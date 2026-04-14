import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE
});

async function checkCRM() {
    const q1 = `SELECT count(distinct lead_id) as total_crm_leads, max(created_at) as last_lead FROM \`crypto-world-epta.foryou_analytics.leads_all_history_full\``;
    const [rows1] = await bq.query(q1);
    console.log(`Total Leads in History Table: ${rows1[0].total_crm_leads}`);
    console.log(`Last Lead Created At: ${rows1[0].last_lead.value}`);

    const q2 = `SELECT count(distinct lead_id) as leads_with_phones FROM \`crypto-world-epta.foryou_analytics.amo_lead_phones\``;
    const [rows2] = await bq.query(q2);
    console.log(`Total Leads with Phones in Mapping: ${rows2[0].leads_with_phones}`);
}

checkCRM().catch(console.error);
