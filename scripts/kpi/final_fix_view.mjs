import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function fixEverything() {
    console.log('--- REBUILDING MASTER VIEW FOR BOTH TABLE AND SCORECARDS ---');
    
    const query = `
        CREATE OR REPLACE VIEW \`crypto-world-epta.foryou_analytics.department_performance_all\` AS
        -- 1. Combine Deals and Marketing Spend
        WITH combined AS (
            -- DEALS
            SELECT 
                date,
                department,
                source,
                price,
                gross as revenue,
                net as income,
                0 as spend
            FROM \`crypto-world-epta.foryou_analytics.deals_performance_detailed\`
            
            UNION ALL
            
            -- MARKETING SPENDS (Treat as separate rows with 0 deals)
            SELECT 
                date,
                'Marketing' as department, -- Group spent rows under Marketing
                source,
                0 as price,
                0 as revenue,
                0 as income,
                spend
            FROM \`crypto-world-epta.foryou_analytics.marketing_spend\`
        )
        SELECT 
            date,
            department,
            source,
            price,
            revenue,
            income,
            spend,
            (revenue - spend) as gross_profit,
            SAFE_DIVIDE(revenue, spend) as ROAS,
            (income - spend) as net_profit,

            -- 2. pivoted metrics for scorecards (ASCII Names - Rename in Looker)
            IF(department = 'Первичка', income, NULL) as income_pervichka,
            IF(department = 'Вторичка', income, NULL) as income_vtorichka,
            IF(department = 'Аренда', income, NULL) as income_arenda,
            IF(department = 'Сопровождение', income, NULL) as income_support,
            
            IF(department = 'Первичка', price, NULL) as price_pervichka,
            IF(department = 'Вторичка', price, NULL) as price_vtorichka,
            IF(department = 'Аренда', price, NULL) as price_arenda,
            IF(department = 'Сопровождение', price, NULL) as price_support,
            
            IF(department = 'Первичка', revenue, NULL) as gross_pervichka,
            IF(department = 'Вторичка', revenue, NULL) as gross_vtorichka,
            IF(department = 'Аренда', revenue, NULL) as gross_arenda,
            IF(department = 'Сопровождение', revenue, NULL) as gross_support,

            IF(department = 'Первичка', 1, NULL) as count_pervichka,
            IF(department = 'Вторичка', 1, NULL) as count_vtorichka,
            IF(department = 'Аренда', 1, NULL) as count_arenda,
            IF(department = 'Сопровождение', 1, NULL) as count_support,
            
            IF(department = 'Первичка', SAFE_DIVIDE(revenue - income, revenue), NULL) as broker_pct_pervichka,
            IF(department = 'Вторичка', SAFE_DIVIDE(revenue - income, revenue), NULL) as broker_pct_vtorichka,
            IF(department = 'Аренда', SAFE_DIVIDE(revenue - income, revenue), NULL) as broker_pct_arenda,
            IF(department = 'Сопровождение', SAFE_DIVIDE(revenue - income, revenue), NULL) as broker_pct_support
        FROM combined
        -- In the future, we will join expenses here
    `;

    await bq.query(query);
    console.log('SUCCESS: Master View is now hybrid. Both scorecards and tables will work.');
}

fixEverything().catch(console.error);
