import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function checkViewData() {
    const query = 'SELECT * FROM `crypto-world-epta.foryou_analytics.FORYOU_KPI_FINAL_MASTER` WHERE month = "2026-03-01" LIMIT 10';
    const [rows] = await bq.query(query);
    console.log('--- FINAL MASTER VIEW DATA (March 2026) ---');
    console.table(rows.map(r => ({
        broker: r.broker,
        fact_leads: r.fact_leads,
        target_leads: r.target_leads,
        leads_pct: r.leads_percent
    })));
}

checkViewData().catch(console.error);
