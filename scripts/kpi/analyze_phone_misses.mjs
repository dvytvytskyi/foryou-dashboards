import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE
});

async function analyze() {
    console.log('--- PF FORMATS (TOP 5) ---');
    const [pf] = await bq.query(`
        SELECT 
            left(customer_phone, 4) as prefix, 
            length(customer_phone) as len, 
            count(*) as cnt 
        FROM \`crypto-world-epta.foryou_analytics.pf_leads_raw\` 
        WHERE customer_phone IS NOT NULL 
        GROUP BY 1, 2 
        ORDER BY 3 DESC 
        LIMIT 5
    `);
    console.table(pf);

    console.log('\n--- AMO FORMATS (TOP 5) ---');
    const [amo] = await bq.query(`
        SELECT 
            left(phone, 3) as prefix, 
            length(phone) as len, 
            count(*) as cnt 
        FROM \`crypto-world-epta.foryou_analytics.amo_lead_phones\` 
        WHERE phone IS NOT NULL 
        GROUP BY 1, 2 
        ORDER BY 3 DESC 
        LIMIT 5
    `);
    console.table(amo);

    console.log('\n--- EXAMPLES OF POTENTIAL MISSES ---');
    // Find phones that end with the same 7 digits but are not matched
    const [misses] = await bq.query(`
        SELECT 
            p.customer_phone as pf, 
            a.phone as amo 
        FROM \`crypto-world-epta.foryou_analytics.pf_leads_raw\` p
        JOIN \`crypto-world-epta.foryou_analytics.amo_lead_phones\` a 
          ON RIGHT(REPLACE(REPLACE(REPLACE(p.customer_phone, ' ', ''), '+', ''), '-', ''), 7) = RIGHT(a.phone, 7)
        WHERE REPLACE(REPLACE(REPLACE(p.customer_phone, ' ', ''), '+', ''), '-', '') != a.phone
        LIMIT 10
    `);
    console.log(`Found ${misses.length} potential matches by last 7 digits that are not direct matches.`);
    console.table(misses);
}

analyze().catch(console.error);
