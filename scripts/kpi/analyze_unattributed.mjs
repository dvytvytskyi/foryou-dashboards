import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';
import fs from 'fs';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function analyzeUnattributedLeads() {
    const query = `
        SELECT 
            *
        FROM \`crypto-world-epta.foryou_analytics.amo_channel_leads_raw\`
        WHERE source_label LIKE '%Property%'
        AND lead_id NOT IN (
            SELECT DISTINCT CAST(lead_id AS INT64) 
            FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\`
            WHERE listing_ref IS NOT NULL AND listing_ref != '0'
        )
        ORDER BY created_at DESC
        LIMIT 10
    `;
    
    const [rows] = await bq.query(query);
    console.log('--- SAMPLE OF UNATTRIBUTED LEADS ---');
    rows.forEach(r => {
        console.log(`ID: ${r.lead_id} | Created: ${r.created_at.value} | Source: ${r.source_label}`);
        // Check for common fields if possible
        // Note: custom_fields is usually a stringified JSON or STRUCT in BQ
        console.log(`Data: ${JSON.stringify(r.custom_fields).slice(0, 200)}...`);
        console.log('-------------------');
    });
}

analyzeUnattributedLeads().catch(console.error);
