import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function restoreLogic() {
    console.log('--- REBUILDING MASTER VIEW (STABLE VERSION) ---');
    
    const viewQuery = `
        CREATE OR REPLACE VIEW \`crypto-world-epta.foryou_analytics.department_performance_all\` AS
        SELECT 
          CAST(date AS DATE) as date,
          source,
          -- Restore department mapping for filters
          CASE 
             WHEN source IN ('Листинг', 'RED', 'Лид RED', 'PF', 'Лид PF', 'FB', 'Лид FB', 'Лид компании', 'Собственный клиент', 'Собственный лид') THEN 'Первичка'
             WHEN source LIKE '%Вторичка%' OR source LIKE '%Secondary%' THEN 'Вторичка'
             WHEN source LIKE '%Аренда%' OR source LIKE '%Rent%' THEN 'Аренда'
             ELSE 'Первичка'
          END as department,
          income,
          revenue,
          spend,
          deals_count
        FROM \`crypto-world-epta.foryou_analytics.global_perf_v4\`
        QUALIFY ROW_NUMBER() OVER(PARTITION BY date, source ORDER BY updated_at DESC) = 1
    `;

    await bq.query(viewQuery);
    console.log('SUCCESS: View updated. Department filters should now work.');
}

restoreLogic().catch(console.error);
