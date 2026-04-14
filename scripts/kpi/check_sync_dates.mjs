import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE
});

async function checkDates() {
    const q1 = `SELECT max(created_at) as last_pf FROM \`crypto-world-epta.foryou_analytics.pf_leads_raw\``;
    const [rows1] = await bq.query(q1);
    console.log(`Last Property Finder Lead: ${rows1[0].last_pf.value}`);

    const q2 = `SELECT max(created_at) as last_crm FROM \`crypto-world-epta.foryou_analytics.leads_all_history_full\``;
    const [rows2] = await bq.query(q2);
    console.log(`Last CRM Lead in BigQuery: ${rows2[0].last_crm.value}`);
}

checkDates().catch(console.error);
