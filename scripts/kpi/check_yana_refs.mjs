import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE
});

async function checkRefs() {
    const query = `
        SELECT listing_ref, listing_id 
        FROM \`crypto-world-epta.foryou_analytics.pf_listings_raw\` 
        WHERE listing_ref LIKE '%30371%' 
           OR listing_ref LIKE '%9674%'
           OR listing_ref LIKE '%8439%'
        LIMIT 5
    `;
    const [rows] = await bq.query(query);
    console.log('--- MATCHING REFERENCES IN BIGQUERY ---');
    console.table(rows);
}

checkRefs().catch(console.error);
