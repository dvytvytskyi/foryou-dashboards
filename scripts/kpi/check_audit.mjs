import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkAuditColumns() {
    const query = 'SELECT * FROM `crypto-world-epta.foryou_analytics.lead_audit_v3_clean` LIMIT 1';
    const [rows] = await bq.query(query);
    console.log('Columns in lead_audit_v3_clean:', Object.keys(rows[0]));
    console.log('Sample data:', rows[0]);
}

checkAuditColumns().catch(console.error);
