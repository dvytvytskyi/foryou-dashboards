import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function syncAds() {
    console.log('--- SYNCING MARKETING SPEND (ADS) ---');
    
    // Manual data provided by the user (matching CRM sources mapping)
    const adsData = [
        { date: '2026-03-01', source: 'PF', spend: 47775, platform: 'PROPERTY FINDER' },
        { date: '2026-03-01', source: 'RED', spend: 83676, platform: 'Лидген RED' },
        { date: '2026-03-01', source: 'SMM', spend: 9175, platform: 'Лена СММ' },
        { date: '2026-03-01', source: 'Site', spend: 901, platform: 'Сайт' },
        { date: '2026-03-01', source: 'Facebook', spend: 106, platform: 'Facebook' },
        
        // Let's also add some dummy data for Feb if needed, but Feb was not asked.
    ];

    const valuesStr = adsData.map(d => `(DATE '${d.date}', '${d.source}', ${d.spend}, '${d.platform}')`).join(',\n');
    
    const query = `
        CREATE OR REPLACE TABLE \`crypto-world-epta.foryou_analytics.marketing_spend\` AS
        SELECT * FROM UNNEST([
            STRUCT<date DATE, source STRING, spend FLOAT64, platform STRING>
            ${valuesStr}
        ])
    `;

    await bq.query(query);
    console.log('SUCCESS: Marketing Spend synced to BigQuery.');
}

syncAds().catch(console.error);
