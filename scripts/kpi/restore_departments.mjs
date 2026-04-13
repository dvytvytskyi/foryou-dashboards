import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function restoreDepartments() {
    console.log('--- RESTORING DEPARTMENTAL SPLIT IN BIGQUERY VIEW ---');
    
    // This view maps sources to departments and creates separate columns for Looker scorecards
    const query = `
        CREATE OR REPLACE VIEW \`crypto-world-epta.foryou_analytics.department_performance_all\` AS
        WITH base AS (
            SELECT 
                date,
                source,
                spend,
                deals_count,
                revenue,
                income,
                CASE 
                    WHEN source IN ('RED', 'Facebook', 'Сайт', 'SMM', 'Listing', 'Собственный лид', 'Лид RED') THEN 'Первичка'
                    WHEN source IN ('Secondary', 'Лид PF') THEN 'Вторичка'
                    WHEN source IN ('Partnership') THEN 'Партнерка'
                    WHEN source IN ('Аренда', 'Rent') THEN 'Аренда'
                    ELSE 'Первичка'
                END as dept_name
            FROM \`crypto-world-epta.foryou_analytics.global_perf_final_cleaned\`
        )
        SELECT 
            *,
            IF(dept_name = 'Первичка', income, 0) as income_pervichka,
            IF(dept_name = 'Вторичка', income, 0) as income_vtorichka,
            IF(dept_name = 'Аренда', income, 0) as income_arenda,
            IF(dept_name = 'Партнерка', income, 0) as income_partnership
        FROM base
    `;

    await bq.query(query);
    console.log('SUCCESS: Departmental split restored. Columns income_pervichka, etc. are back.');
}

restoreDepartments().catch(console.error);
