import path from 'path';
import { fileURLToPath } from 'url';
import { BigQuery } from '@google-cloud/bigquery';
import { CLOSED_DEAL_STATUS_IDS } from '../../src/lib/crmRules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'partners_drilldown_daily';
const CLOSED_DEAL_STATUS_SQL = CLOSED_DEAL_STATUS_IDS.join(', ');

// Partners pipeline 8600274 only
const PARTNERS_FILTER = `a.pipeline_id = 8600274`;

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: path.resolve(rootDir, 'secrets/crypto-world-epta-2db29829d55d.json'),
});

async function createPartnersTable() {
    console.log('--- BUILDING PARTNERS UTM DRILLDOWN ---');

    const query = `
        CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\` AS
        WITH latest_amo AS (
            SELECT * EXCEPT(row_num)
            FROM (
                SELECT
                    lead_id,
                    pipeline_id,
                    status_id,
                    source_label,
                    client_type_enum_id,
                    utm_source,
                    utm_medium,
                    utm_campaign,
                    utm_content,
                    price,
                    created_at,
                    updated_at,
                    ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY updated_at DESC) AS row_num
                FROM \`${PROJECT_ID}.${DATASET_ID}.amo_channel_leads_raw\`
            )
            WHERE row_num = 1
        ),
        partners_raw AS (
            SELECT
                DATE(a.created_at) AS report_date,
                COALESCE(NULLIF(TRIM(a.utm_source), ''), 'Unknown source')   AS utm_source,
                COALESCE(NULLIF(TRIM(a.utm_medium), ''), 'Unknown medium')   AS utm_medium,
                COALESCE(NULLIF(TRIM(a.utm_campaign), ''), 'Unknown campaign') AS utm_campaign,
                COALESCE(NULLIF(TRIM(a.utm_content), ''), 'Unknown content') AS utm_content,
                a.lead_id,
                a.status_id,
                COALESCE(a.price, 0) AS price
            FROM latest_amo a
            WHERE ${PARTNERS_FILTER}
        ),
        lead_flags AS (
            SELECT
                report_date,
                utm_source,
                utm_medium,
                utm_campaign,
                utm_content,
                COUNT(DISTINCT lead_id) AS leads,
                -- Закрыто и не реализовано
                COUNTIF(status_id = 143) AS no_answer_spam,
                -- Квалифицирован + активный партнер + Отложенный интерес + Холодные/ETC + Успешно реализовано + Закрыто и не реализовано
                COUNTIF(status_id IN (69778170, 85193922, 85193926, 85192326, 142, 143)) AS qualified_leads,
                -- Квалифицирован + активный партнер + Холодные/ETC + Успешно реализовано
                COUNTIF(status_id IN (69778170, 85193922, 85192326, 142)) AS ql_actual,
                -- не використовується у Partners (залишаємо 0)
                COUNTIF(FALSE) AS meetings,
                -- Успешно реализовано
                COUNTIF(status_id IN (${CLOSED_DEAL_STATUS_SQL})) AS deals,
                SUM(IF(status_id IN (${CLOSED_DEAL_STATUS_SQL}), price, 0)) AS revenue
            FROM partners_raw
            GROUP BY 1, 2, 3, 4, 5
        )
        SELECT
            report_date,
            'Partners leads'                                AS channel,
            utm_source                                      AS level_1,
            utm_medium                                      AS level_2,
            utm_campaign                                    AS level_3,
            utm_content                                     AS level_4,
            leads,
            no_answer_spam,
            SAFE_DIVIDE(CAST(leads - no_answer_spam AS FLOAT64), leads)   AS rate_answer,
            qualified_leads,
            0.0                                             AS budget,
            0.0                                             AS cpl,
            0.0                                             AS cost_per_qualified_leads,
            SAFE_DIVIDE(CAST(qualified_leads AS FLOAT64), leads)          AS cr_ql,
            ql_actual,
            0.0                                             AS cpql_actual,
            meetings,
            0.0                                             AS cp_meetings,
            deals,
            0.0                                             AS cost_per_deal,
            revenue,
            0.0                                             AS roi,
            revenue                                         AS company_revenue,
            CURRENT_TIMESTAMP()                             AS refreshed_at
        FROM lead_flags
        WHERE report_date IS NOT NULL
        ORDER BY report_date DESC, leads DESC
    `;

    await bq.query({ query });
    const [meta] = await bq.query({
        query: `SELECT COUNT(*) AS cnt, MAX(report_date) AS last_date FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\``,
    });
    console.log(`✓ ${TABLE_ID} rebuilt: ${meta[0].cnt} rows, last date ${meta[0].last_date?.value ?? meta[0].last_date}`);
}

createPartnersTable().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});
