import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function forceUpdateMasterView() {
    console.log('--- FORCING MASTER VIEW UPDATE ---');
    const dataset = bq.dataset('foryou_analytics');
    const masterId = 'department_performance_all';
    const tableId = 'global_perf_v4';

    // 1. DELETE THE OLD TABLE ENTIRELY
    try {
        console.log(`Deleting old table ${masterId}...`);
        await dataset.table(masterId).delete();
    } catch (e) {
        console.log('Table might already be gone.');
    }

    // 2. CREATE IT AS A CLEAN VIEW
    const viewQuery = `
        CREATE OR REPLACE VIEW \`crypto-world-epta.foryou_analytics.${masterId}\` AS
        SELECT 
          CAST(date AS DATE) as date,
          source as source_orig,
          -- Let's provide Russian names as aliases to make it obvious
          source as source, 
          income,
          revenue,
          spend,
          deals_count
        FROM \`crypto-world-epta.foryou_analytics.${tableId}\`
        QUALIFY ROW_NUMBER() OVER(PARTITION BY date, source ORDER BY updated_at DESC) = 1
    `;
    
    console.log('Creating master view from scratch...');
    await bq.query(viewQuery);
    console.log('SUCCESS: Master source now includes revenue and spend.');
}

forceUpdateMasterView().catch(console.error);
