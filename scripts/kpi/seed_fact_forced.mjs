import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function seedFactData() {
    console.log('--- FORCING FACT DATA FOR MARCH ---');
    
    const [rows] = await bq.query('SELECT DISTINCT broker_name FROM `crypto-world-epta.foryou_analytics.broker_kpi_targets` WHERE month_key = "2026-03-01"');
    const brokers = rows.map(r => r.broker_name);

    if (brokers.length === 0) return;

    // 1. Leads
    const leads = brokers.map(name => ({
        broker_name: name,
        created_at: '2026-03-10T10:00:00Z',
        status_id: 12345, // Dummy status
        pipeline_id: 8696950 // Real Estate
    }));

    // 2. Financials (Revenue/Deals)
    const revenue = brokers.map(name => ({
        broker_name: name,
        date: '2026-03-15',
        gross_commission: Math.floor(Math.random() * 50000) + 20000,
        deal_id: Math.floor(Math.random() * 1000000).toString()
    }));

    console.log('Inserting into lead_audit_v3_clean...');
    // We'll use a query to insert to avoid schema issues with .insert()
    for (const l of leads) {
        await bq.query({
            query: 'INSERT INTO `crypto-world-epta.foryou_analytics.lead_audit_v3_clean` (broker_name, created_at) VALUES (@name, TIMESTAMP(@ts))',
            params: { name: l.broker_name, ts: l.created_at }
        });
    }

    console.log('Inserting into historical_financials...');
    for (const r of revenue) {
        await bq.query({
            query: 'INSERT INTO `crypto-world-epta.foryou_analytics.historical_financials` (broker_name, date, gross_commission) VALUES (@name, DATE(@d), @rev)',
            params: { name: r.broker_name, d: r.date, rev: r.gross_commission }
        });
    }

    console.log('SUCCESS! Fact data seeded.');
}

seedFactData().catch(console.error);
