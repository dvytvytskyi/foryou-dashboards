import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';
import fs from 'fs';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'broker_kpi_targets';
const SERVICE_ACCOUNT_FILE = path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');
const AMO_TOKENS_FILE = path.join(process.cwd(), 'secrets/amo_tokens.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function getBrokersSeed() {
    try {
        const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
        const domain = 'reforyou.amocrm.ru';
        const res = await fetch(`https://${domain}/api/v4/users`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        const data = await res.json();
        return data._embedded?.users?.map(u => ({ name: u.name })) || [];
    } catch (e) {
        return [{name: 'Даниил Невзоров'}, {name: 'Камол Шукуров'}, {name: 'Радик Погосян'}];
    }
}

async function seedKpi() {
    console.log('--- Fixing Seed data format for Looker ---');
    const brokers = await getBrokersSeed();
    const month = '2026-03-01'; // MATCHING LOOKER FORMAT
    
    const rows = brokers.map(b => ({
        month_key: month,
        broker_name: b.name,
        target_leads: Math.floor(Math.random() * 50) + 50,
        target_deals: Math.floor(Math.random() * 4) + 1,
        target_revenue: (Math.floor(Math.random() * 5) + 2) * 50000,
        crm_quality: ['Высокий', 'Средне', 'Низко'][Math.floor(Math.random() * 3)],
        updated_at: new Date().toISOString()
    }));

    await bq.dataset(DATASET_ID).table(TABLE_ID).insert(rows);
    console.log(`Successfully seeded ${rows.length} records for ${month}`);
}

seedKpi().catch(console.error);
