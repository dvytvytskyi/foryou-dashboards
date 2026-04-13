import path from 'path';
import { fileURLToPath } from 'url';
import { BigQuery } from '@google-cloud/bigquery';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'red_channel_daily';

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: path.resolve(rootDir, 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function createRedChannelDaily() {
    console.log('--- BUILDING RED LOOKER MART (red_channel_daily) ---');

    const query = `
        CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\` AS
        WITH latest_red AS (
            SELECT * EXCEPT(row_num)
            FROM (
                SELECT
                    lead_id,
                    SAFE_CAST(date AS DATE) AS report_date,
                    tab_source,
                    utm_source,
                    utm_campaign,
                    utm_medium,
                    utm_content,
                    updated_at,
                    ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY updated_at DESC) AS row_num
                FROM \`${PROJECT_ID}.${DATASET_ID}.red_leads_raw\`
                WHERE SAFE_CAST(date AS DATE) IS NOT NULL
            )
            WHERE row_num = 1
        ),
        latest_crm AS (
            SELECT * EXCEPT(row_num)
            FROM (
                SELECT
                    lead_id,
                    status_id,
                    price,
                    created_at,
                    closed_at,
                    ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY created_at DESC) AS row_num
                FROM \`${PROJECT_ID}.${DATASET_ID}.leads_all_history_full\`
            )
            WHERE row_num = 1
        ),
        latest_loss AS (
            SELECT * EXCEPT(row_num)
            FROM (
                SELECT
                    lead_id,
                    LOWER(COALESCE(loss_reason_name, '')) AS loss_reason_name,
                    ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY updated_at DESC) AS row_num
                FROM \`${PROJECT_ID}.${DATASET_ID}.leads_loss_reasons\`
            )
            WHERE row_num = 1
        ),
        lead_level AS (
            SELECT
                r.report_date,
                'RED' AS channel,
                r.lead_id,
                r.tab_source,
                r.utm_source,
                r.utm_campaign,
                r.utm_medium,
                r.utm_content,
                c.status_id,
                COALESCE(c.price, 0) AS price,
                l.loss_reason_name,
                m.date_qual,
                m.date_meet,
                IF(
                    c.status_id IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)
                    OR m.date_qual IS NOT NULL,
                    1,
                    0
                ) AS is_qualified,
                IF(c.status_id IN (70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586), 1, 0) AS is_ql_actual,
                IF(
                    c.status_id IN (70457474, 70457478, 70457482, 70457486, 70757586, 142)
                    OR m.date_meet IS NOT NULL,
                    1,
                    0
                ) AS is_meeting,
                IF(c.status_id = 142, 1, 0) AS is_deal,
                IF(
                    c.status_id = 143
                    AND REGEXP_CONTAINS(COALESCE(l.loss_reason_name, ''), r'(нет ответа|спам|тест)'),
                    1,
                    0
                ) AS is_no_answer_spam
            FROM latest_red r
            LEFT JOIN latest_crm c USING (lead_id)
            LEFT JOIN latest_loss l USING (lead_id)
            LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.milestones\` m
                ON CAST(r.lead_id AS STRING) = m.deal_id
        ),
        date_bounds AS (
            SELECT
                MIN(report_date) AS min_date,
                GREATEST(MAX(report_date), CURRENT_DATE()) AS max_date
            FROM lead_level
        ),
        calendar AS (
            SELECT report_date
            FROM date_bounds,
            UNNEST(GENERATE_DATE_ARRAY(min_date, max_date)) AS report_date
        ),
        monthly_spend AS (
            SELECT
                DATE_TRUNC(date, MONTH) AS report_month,
                SUM(spend) AS monthly_budget
            FROM \`${PROJECT_ID}.${DATASET_ID}.marketing_spend\`
            WHERE UPPER(source) = 'RED'
            GROUP BY 1
        ),
        monthly_financials AS (
            SELECT
                DATE_TRUNC(date, MONTH) AS report_month,
                SUM(spend) AS monthly_spend_fallback,
                SUM(revenue) AS monthly_revenue_sheet,
                SUM(income) AS monthly_company_revenue
            FROM \`${PROJECT_ID}.${DATASET_ID}.global_performance_master\`
            WHERE UPPER(source) LIKE '%RED%'
            GROUP BY 1
        ),
        daily_financials AS (
            SELECT
                c.report_date,
                COALESCE(ms.monthly_budget, mf.monthly_spend_fallback, 0)
                    / EXTRACT(DAY FROM LAST_DAY(c.report_date, MONTH)) AS budget,
                COALESCE(mf.monthly_company_revenue, 0)
                    / EXTRACT(DAY FROM LAST_DAY(c.report_date, MONTH)) AS company_revenue_sheet,
                COALESCE(mf.monthly_revenue_sheet, 0)
                    / EXTRACT(DAY FROM LAST_DAY(c.report_date, MONTH)) AS revenue_sheet_fallback
            FROM calendar c
            LEFT JOIN monthly_spend ms
                ON DATE_TRUNC(c.report_date, MONTH) = ms.report_month
            LEFT JOIN monthly_financials mf
                ON DATE_TRUNC(c.report_date, MONTH) = mf.report_month
        ),
        daily_leads AS (
            SELECT
                report_date,
                'RED' AS channel,
                COUNT(DISTINCT lead_id) AS leads,
                SUM(is_no_answer_spam) AS no_answer_spam,
                SUM(is_qualified) AS qualified_leads,
                SUM(is_ql_actual) AS ql_actual,
                SUM(is_meeting) AS meetings,
                SUM(is_deal) AS deals,
                SUM(IF(is_deal = 1, price, 0)) AS revenue
            FROM lead_level
            GROUP BY 1, 2
        )
        SELECT
            c.report_date,
            'RED' AS channel,
            COALESCE(df.budget, 0) AS budget,
            COALESCE(dl.leads, 0) AS leads,
            SAFE_DIVIDE(COALESCE(df.budget, 0), NULLIF(COALESCE(dl.leads, 0), 0)) AS cpl,
            COALESCE(dl.no_answer_spam, 0) AS no_answer_spam,
            SAFE_DIVIDE(
                COALESCE(dl.leads, 0) - COALESCE(dl.no_answer_spam, 0),
                NULLIF(COALESCE(dl.leads, 0), 0)
            ) AS rate_answer,
            COALESCE(dl.qualified_leads, 0) AS qualified_leads,
            SAFE_DIVIDE(COALESCE(df.budget, 0), NULLIF(COALESCE(dl.qualified_leads, 0), 0)) AS cost_per_qualified_leads,
            SAFE_DIVIDE(COALESCE(dl.qualified_leads, 0), NULLIF(COALESCE(dl.leads, 0), 0)) AS cr_ql,
            COALESCE(dl.ql_actual, 0) AS ql_actual,
            SAFE_DIVIDE(COALESCE(df.budget, 0), NULLIF(COALESCE(dl.ql_actual, 0), 0)) AS cpql_actual,
            COALESCE(dl.meetings, 0) AS meetings,
            SAFE_DIVIDE(COALESCE(df.budget, 0), NULLIF(COALESCE(dl.meetings, 0), 0)) AS cp_meetings,
            COALESCE(dl.deals, 0) AS deals,
            SAFE_DIVIDE(COALESCE(df.budget, 0), NULLIF(COALESCE(dl.deals, 0), 0)) AS cost_per_deal,
            COALESCE(dl.revenue, df.revenue_sheet_fallback, 0) AS revenue,
            SAFE_DIVIDE(COALESCE(dl.revenue, df.revenue_sheet_fallback, 0), NULLIF(COALESCE(df.budget, 0), 0)) AS roi,
            COALESCE(df.company_revenue_sheet, 0) AS company_revenue,
            CURRENT_TIMESTAMP() AS refreshed_at
        FROM calendar c
        LEFT JOIN daily_financials df USING (report_date)
        LEFT JOIN daily_leads dl USING (report_date)
        ORDER BY c.report_date DESC
    `;

    await bq.query(query);
    console.log(`SUCCESS: ${TABLE_ID} refreshed.`);
}

createRedChannelDaily().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});