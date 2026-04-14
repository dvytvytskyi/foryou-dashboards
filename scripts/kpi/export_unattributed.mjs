import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';
import fs from 'fs';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function exportUnattributedLeads() {
    const query = `
        SELECT 
            *
        FROM \`crypto-world-epta.foryou_analytics.amo_channel_leads_raw\`
        WHERE source_label = 'Property finder'
        AND lead_id NOT IN (
            SELECT DISTINCT CAST(crm_lead_id AS INT64) 
            FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\`
            WHERE crm_lead_id IS NOT NULL
        )
        AND created_at >= '2024-01-01'
        ORDER BY created_at DESC
    `;
    
    console.log('Fetching unattributed leads from BigQuery...');
    const [rows] = await bq.query(query);
    
    const outputPath = path.resolve(process.cwd(), 'unattributed_pf_leads.json');
    fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2));
    
    console.log(`Successfully exported ${rows.length} leads to ${outputPath}`);
}

exportUnattributedLeads().catch(console.error);
