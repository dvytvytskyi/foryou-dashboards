import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function seedFactData() {
    console.log('--- SEEDING RANDOM FACT DATA FOR MARCH ---');
    
    // 1. Get brokers from the targets table to match them
    const [rows] = await bq.query('SELECT DISTINCT broker_name FROM `crypto-world-epta.foryou_analytics.broker_kpi_targets` WHERE month_key = "2026-03-01"');
    const brokers = rows.map(r => r.broker_name);

    if (brokers.length === 0) {
        console.error('No brokers found');
        return;
    }

    // 2. Generate random leads for lead_audit_v3_clean
    const leads = [];
    brokers.forEach(name => {
        const count = Math.floor(Math.random() * 15) + 5; // 5-20 leads
        for (let i = 0; i < count; i++) {
            leads.push({
                broker_name: name,
                created_at: '2026-03-15T12:00:00Z',
                status: 'test_fact'
            });
        }
    });

    await bq.dataset('foryou_analytics').table('lead_audit_v3_clean').insert(leads);

    // 3. Generate random revenue for historical_financials
    const revenue = brokers.map(name => ({
        broker_name: name,
        date: '2026-03-20',
        gross_commission: (Math.floor(Math.random() * 10) + 1) * 10000 // 10k-100k
    }));

    await bq.dataset('foryou_analytics').table('historical_financials').insert(revenue);

    console.log(`Success! Inserted fact data for ${brokers.length} brokers.`);
}

seedFactData().catch(console.error);
