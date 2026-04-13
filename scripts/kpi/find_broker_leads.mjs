import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function findBrokerLeads() {
    // We'll look for keywords in lead names from the full history
    const query = `
        SELECT name, COUNT(*) as count
        FROM \`crypto-world-epta.foryou_analytics.leads_all_history_full\`
        WHERE REGEXP_CONTAINS(LOWER(name), r'личн|собств|own|partner|партнер')
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 50
    `;
    const [rows] = await bq.query(query);
    console.log('Sample leads matching personal keywords:');
    console.log(JSON.stringify(rows, null, 2));
    
    // Also check the source fields if they exist in raw leads
    const sourceQuery = `
        SELECT source_label, COUNT(*) as count
        FROM \`crypto-world-epta.foryou_analytics.amo_channel_leads_raw\`
        GROUP BY 1
        ORDER BY count DESC
    `;
    const [sourceRows] = await bq.query(sourceQuery);
    console.log('\nLeads by Source:');
    console.log(JSON.stringify(sourceRows, null, 2));
}

findBrokerLeads();
