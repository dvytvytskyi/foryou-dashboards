import path from 'path';
import { fileURLToPath } from 'url';
import { BigQuery } from '@google-cloud/bigquery';
import { CLOSED_DEAL_STATUS_IDS } from '../../src/lib/crmRules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'marketing_channel_drilldown_daily';
const CLOSED_DEAL_STATUS_SQL = CLOSED_DEAL_STATUS_IDS.join(', ');
const RED_STRICT_REGEX = '(red_ru|red_eng|red_arm|red_lux)';
const FB_EXCLUDED_LEVEL1_REGEX = '(190k[ _-]*oman|radik[ _-]*oman|svetlana[ _-]*oman)';

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: path.resolve(rootDir, 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function createUnifiedMarketingDrilldownDaily() {
    console.log('--- BUILDING UNIFIED MARKETING DRILLDOWN MART ---');

    const query = `
        CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\` AS
        WITH latest_amo AS (
            SELECT * EXCEPT(row_num)
            FROM (
                SELECT
                    lead_id,
                    name,
                    pipeline_id,
                    pipeline_name,
                    status_id,
                    responsible_user,
                    source_enum_id,
                    source_label,
                    client_type_enum_id,
                    client_type_label,
                    utm_source,
                    utm_campaign,
                    utm_medium,
                    utm_content,
                    tags_text,
                    price,
                    created_at,
                    closed_at,
                    updated_at,
                    ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY updated_at DESC) AS row_num
                FROM \`${PROJECT_ID}.${DATASET_ID}.amo_channel_leads_raw\`
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
        latest_red AS (
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
        red_lead_ids AS (
            SELECT DISTINCT lead_id FROM latest_red
        ),
        red_base AS (
            SELECT
                r.report_date,
                'RED' AS channel,
                r.lead_id,
                COALESCE(r.utm_source, r.tab_source, 'Unknown source') AS level_1,
                COALESCE(r.utm_campaign, r.utm_medium, 'Unknown campaign') AS level_2,
                COALESCE(r.utm_content, 'Unknown creative') AS level_3,
                a.status_id,
                COALESCE(a.price, 0) AS price,
                l.loss_reason_name,
                m.date_qual,
                   m.date_meet,
                   m.date_res,
                   m.date_won
            FROM latest_red r
            LEFT JOIN latest_amo a USING (lead_id)
            LEFT JOIN latest_loss l USING (lead_id)
            LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.milestones\` m
                ON CAST(r.lead_id AS STRING) = m.deal_id
                WHERE
                    REGEXP_CONTAINS(LOWER(COALESCE(a.source_label, '')), r'${RED_STRICT_REGEX}')
                    OR REGEXP_CONTAINS(LOWER(COALESCE(a.tags_text, '')), r'${RED_STRICT_REGEX}')
        ),
        non_red_base AS (
            SELECT
                DATE(a.created_at) AS report_date,
                CASE
                    WHEN a.pipeline_id = 10776450 THEN 'Klykov'
                        WHEN REGEXP_CONTAINS(LOWER(COALESCE(a.source_label, '')), r'${RED_STRICT_REGEX}') THEN 'RED'
                    WHEN REGEXP_CONTAINS(LOWER(COALESCE(a.source_label, '')), r'(property finder|property_finder|pf off-plan|pf offplan|primary plus|prian|bayut)') THEN 'Property Finder'
                    WHEN REGEXP_CONTAINS(LOWER(COALESCE(a.source_label, '')), r'oman') THEN 'Facebook'
                    WHEN a.pipeline_id = 8696950
                        AND REGEXP_CONTAINS(LOWER(COALESCE(a.source_label, '')), r'(target point|facebook)') THEN 'Facebook'
                    WHEN a.pipeline_id = 8600274
                         OR a.client_type_enum_id = 695223
                         OR REGEXP_CONTAINS(LOWER(COALESCE(a.source_label, '')), r'(partner|партнер)') THEN 'Partners leads'
                    WHEN TRIM(COALESCE(a.source_label, '')) != '' THEN 'Own leads'
                    WHEN REGEXP_CONTAINS(LOWER(COALESCE(a.tags_text, '')), r'(klykov leads|klykov)') THEN 'Klykov'
                        WHEN REGEXP_CONTAINS(LOWER(COALESCE(a.tags_text, '')), r'${RED_STRICT_REGEX}') THEN 'RED'
                    WHEN REGEXP_CONTAINS(LOWER(COALESCE(a.tags_text, '')), r'(property finder|property_finder|pf off-plan|pf offplan|primary plus|prian|bayut)') THEN 'Property Finder'
                    WHEN REGEXP_CONTAINS(LOWER(COALESCE(a.tags_text, '')), r'oman') THEN 'Facebook'
                    WHEN a.pipeline_id = 8696950
                        AND REGEXP_CONTAINS(LOWER(COALESCE(a.tags_text, '')), r'(target point|facebook)') THEN 'Facebook'
                    WHEN REGEXP_CONTAINS(LOWER(COALESCE(a.tags_text, '')), r'(partner|партнер)') THEN 'Partners leads'
                    WHEN TRIM(COALESCE(a.tags_text, '')) != '' THEN 'Own leads'
                    ELSE 'ETC'
                END AS channel,
                a.lead_id,
                COALESCE(NULLIF(a.source_label, ''), NULLIF(a.tags_text, ''), CONCAT('pipeline_', CAST(a.pipeline_id AS STRING))) AS level_1,
                COALESCE(a.utm_campaign, a.utm_medium, 'Unknown campaign') AS level_2,
                COALESCE(a.utm_content, 'Unknown creative') AS level_3,
                a.status_id,
                COALESCE(a.price, 0) AS price,
                l.loss_reason_name,
                m.date_qual,
                   m.date_meet,
                   m.date_res,
                   m.date_won
            FROM latest_amo a
            LEFT JOIN latest_loss l USING (lead_id)
            LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.milestones\` m
                ON CAST(a.lead_id AS STRING) = m.deal_id
            LEFT JOIN red_lead_ids red
                ON a.lead_id = red.lead_id
            WHERE red.lead_id IS NULL
              -- Partners pipeline handled separately in partners_drilldown_daily
              AND NOT (
                a.pipeline_id = 8600274
                OR a.client_type_enum_id = 695223
                OR REGEXP_CONTAINS(LOWER(COALESCE(a.source_label, '')), r'(partner|партнер)')
              )
        ),
        all_leads AS (
            SELECT * FROM red_base
            UNION ALL
            SELECT * FROM non_red_base
        ),
        lead_flags AS (
            SELECT
                report_date,
                channel,
                lead_id,
                level_1,
                level_2,
                level_3,
                IF(
                    status_id IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)
                       OR date_qual IS NOT NULL
                       OR date_meet IS NOT NULL
                       OR date_res IS NOT NULL
                       OR date_won IS NOT NULL,
                    1,
                    0
                ) AS is_qualified,
                IF(status_id IN (70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586), 1, 0) AS is_ql_actual,
                IF(
                    status_id IN (70457474, 70457478, 70457482, 70457486, 70757586, 142)
                    OR date_meet IS NOT NULL,
                    1,
                    0
                ) AS is_meeting,
                IF(status_id IN (${CLOSED_DEAL_STATUS_SQL}) AND (channel != 'RED' OR COALESCE(price, 0) > 0), 1, 0) AS is_deal,
                IF(status_id IN (${CLOSED_DEAL_STATUS_SQL}), price, 0) AS revenue,
                IF(
                    status_id = 143,
                    1,
                    0
                ) AS is_no_answer_spam
            FROM all_leads
            WHERE report_date IS NOT NULL
        ),
        monthly_budget AS (
            SELECT
                DATE_TRUNC(date, MONTH) AS report_month,
                CASE
                    WHEN REGEXP_CONTAINS(LOWER(source), r'red') THEN 'RED'
                    WHEN REGEXP_CONTAINS(LOWER(source), r'klykov') THEN 'Klykov'
                    WHEN REGEXP_CONTAINS(LOWER(source), r'(oman|target point)') THEN 'Facebook'
                    WHEN REGEXP_CONTAINS(LOWER(source), r'(property finder|property_finder|pf off-plan|pf offplan|primary plus|prian|bayut)') THEN 'Property Finder'
                    WHEN REGEXP_CONTAINS(LOWER(source), r'partner|партнер') THEN 'Partners leads'
                    WHEN REGEXP_CONTAINS(LOWER(source), r'(website|youtube|wz|gulnoza|artem|личн|serenia|horizon)') THEN 'Own leads'
                    ELSE 'ETC'
                END AS channel,
                SUM(spend) AS monthly_budget
            FROM \`${PROJECT_ID}.${DATASET_ID}.marketing_spend\`
            GROUP BY 1, 2
        ),
        monthly_company_revenue AS (
            SELECT
                DATE_TRUNC(date, MONTH) AS report_month,
                CASE
                    WHEN REGEXP_CONTAINS(LOWER(source), r'red') THEN 'RED'
                    WHEN REGEXP_CONTAINS(LOWER(source), r'klykov') THEN 'Klykov'
                    WHEN REGEXP_CONTAINS(LOWER(source), r'(oman|target point)') THEN 'Facebook'
                    WHEN REGEXP_CONTAINS(LOWER(source), r'(property finder|property_finder|pf off-plan|pf offplan|primary plus|prian|bayut)') THEN 'Property Finder'
                    WHEN REGEXP_CONTAINS(LOWER(source), r'partner|партнер') THEN 'Partners leads'
                    WHEN REGEXP_CONTAINS(LOWER(source), r'(website|youtube|wz|gulnoza|artem|личн|serenia|horizon)') THEN 'Own leads'
                    ELSE 'ETC'
                END AS channel,
                SUM(income) AS monthly_income
            FROM \`${PROJECT_ID}.${DATASET_ID}.global_performance_master\`
            GROUP BY 1, 2
        ),
        budget_calendar AS (
            SELECT
                mb.channel,
                report_date,
                mb.monthly_budget / EXTRACT(DAY FROM LAST_DAY(report_date, MONTH)) AS daily_budget
            FROM monthly_budget mb,
            UNNEST(GENERATE_DATE_ARRAY(mb.report_month, LAST_DAY(mb.report_month, MONTH))) AS report_date
        ),
        company_rev_calendar AS (
            SELECT
                mcr.channel,
                report_date,
                mcr.monthly_income / EXTRACT(DAY FROM LAST_DAY(report_date, MONTH)) AS daily_company_revenue
            FROM monthly_company_revenue mcr,
            UNNEST(GENERATE_DATE_ARRAY(mcr.report_month, LAST_DAY(mcr.report_month, MONTH))) AS report_date
        ),
        channel_day_leads AS (
            SELECT
                report_date,
                channel,
                COUNT(DISTINCT lead_id) AS channel_leads
            FROM lead_flags
            GROUP BY 1, 2
        ),
        detail_day AS (
            SELECT
                report_date,
                channel,
                level_1,
                level_2,
                level_3,
                COUNT(DISTINCT lead_id) AS leads,
                SUM(is_no_answer_spam) AS no_answer_spam,
                SUM(is_qualified) AS qualified_leads,
                SUM(is_ql_actual) AS ql_actual,
                SUM(is_meeting) AS meetings,
                SUM(is_deal) AS deals,
                SUM(revenue) AS revenue
            FROM lead_flags
            WHERE NOT (
                channel = 'Facebook'
                AND REGEXP_CONTAINS(LOWER(COALESCE(level_1, '')), r'${FB_EXCLUDED_LEVEL1_REGEX}')
            )
            GROUP BY 1, 2, 3, 4, 5
        ),
        detail_with_finance AS (
            SELECT
                d.report_date,
                d.channel,
                d.level_1,
                d.level_2,
                d.level_3,
                COALESCE(b.daily_budget, 0) * SAFE_DIVIDE(d.leads, NULLIF(c.channel_leads, 0)) AS budget,
                d.leads,
                d.no_answer_spam,
                d.qualified_leads,
                d.ql_actual,
                d.meetings,
                d.deals,
                d.revenue,
                COALESCE(cr.daily_company_revenue, 0) * SAFE_DIVIDE(d.leads, NULLIF(c.channel_leads, 0)) AS company_revenue
            FROM detail_day d
            LEFT JOIN channel_day_leads c
                ON d.report_date = c.report_date AND d.channel = c.channel
            LEFT JOIN budget_calendar b
                ON d.report_date = b.report_date AND d.channel = b.channel
            LEFT JOIN company_rev_calendar cr
                ON d.report_date = cr.report_date AND d.channel = cr.channel
        ),
        channel_day_summary AS (
            SELECT
                report_date,
                channel,
                SUM(budget) AS budget,
                SUM(leads) AS leads,
                SUM(no_answer_spam) AS no_answer_spam,
                SUM(qualified_leads) AS qualified_leads,
                SUM(ql_actual) AS ql_actual,
                SUM(meetings) AS meetings,
                SUM(deals) AS deals,
                SUM(revenue) AS revenue,
                SUM(company_revenue) AS company_revenue
            FROM detail_with_finance
            GROUP BY 1, 2
        ),
        zero_budget_rows AS (
            SELECT
                b.report_date,
                b.channel,
                '(budget only)' AS level_1,
                '(budget only)' AS level_2,
                '(budget only)' AS level_3,
                b.daily_budget AS budget,
                0 AS leads,
                0 AS no_answer_spam,
                0 AS qualified_leads,
                0 AS ql_actual,
                0 AS meetings,
                0 AS deals,
                0 AS revenue,
                COALESCE(cr.daily_company_revenue, 0) AS company_revenue
            FROM budget_calendar b
            LEFT JOIN channel_day_summary s
                ON b.report_date = s.report_date AND b.channel = s.channel
            LEFT JOIN company_rev_calendar cr
                ON b.report_date = cr.report_date AND b.channel = cr.channel
            WHERE s.channel IS NULL
        ),
        detail_union AS (
            SELECT * FROM detail_with_finance
            UNION ALL
            SELECT * FROM zero_budget_rows
        ),
        total_rows AS (
            SELECT
                report_date,
                'TOTAL' AS channel,
                'TOTAL' AS level_1,
                'TOTAL' AS level_2,
                'TOTAL' AS level_3,
                SUM(budget) AS budget,
                SUM(leads) AS leads,
                SUM(no_answer_spam) AS no_answer_spam,
                SUM(qualified_leads) AS qualified_leads,
                SUM(ql_actual) AS ql_actual,
                SUM(meetings) AS meetings,
                SUM(deals) AS deals,
                SUM(revenue) AS revenue,
                SUM(company_revenue) AS company_revenue
            FROM detail_union
            GROUP BY 1
        ),
        final_rows AS (
            SELECT
                report_date,
                channel,
                level_1,
                level_2,
                level_3,
                budget,
                ROUND(budget * 0.27, 2) AS budget_usd,
                leads,
                SAFE_DIVIDE(budget, NULLIF(leads, 0)) AS cpl,
                ROUND(SAFE_DIVIDE(budget * 0.27, NULLIF(leads, 0)), 2) AS cpl_usd,
                no_answer_spam,
                SAFE_DIVIDE(leads - no_answer_spam, NULLIF(leads, 0)) AS rate_answer,
                qualified_leads,
                SAFE_DIVIDE(budget, NULLIF(qualified_leads, 0)) AS cost_per_qualified_leads,
                ROUND(SAFE_DIVIDE(budget * 0.27, NULLIF(qualified_leads, 0)), 2) AS cost_per_qualified_leads_usd,
                SAFE_DIVIDE(qualified_leads, NULLIF(leads, 0)) AS cr_ql,
                ql_actual,
                SAFE_DIVIDE(budget, NULLIF(ql_actual, 0)) AS cpql_actual,
                ROUND(SAFE_DIVIDE(budget * 0.27, NULLIF(ql_actual, 0)), 2) AS cpql_actual_usd,
                meetings,
                SAFE_DIVIDE(budget, NULLIF(meetings, 0)) AS cp_meetings,
                ROUND(SAFE_DIVIDE(budget * 0.27, NULLIF(meetings, 0)), 2) AS cp_meetings_usd,
                deals,
                SAFE_DIVIDE(budget, NULLIF(deals, 0)) AS cost_per_deal,
                ROUND(SAFE_DIVIDE(budget * 0.27, NULLIF(deals, 0)), 2) AS cost_per_deal_usd,
                revenue,
                ROUND(revenue * 0.27, 2) AS revenue_usd,
                SAFE_DIVIDE(revenue, NULLIF(budget, 0)) AS roi,
                company_revenue,
                ROUND(company_revenue * 0.27, 2) AS company_revenue_usd,
                CASE channel
                    WHEN 'RED' THEN 1
                    WHEN 'Facebook' THEN 2
                    WHEN 'Klykov' THEN 3
                    WHEN 'Property Finder' THEN 4
                    WHEN 'Own leads' THEN 5
                    WHEN 'Partners leads' THEN 6
                    WHEN 'ETC' THEN 7
                    WHEN 'TOTAL' THEN 99
                    ELSE 50
                END AS sort_order,
                CURRENT_TIMESTAMP() AS refreshed_at
            FROM detail_union
            UNION ALL
            SELECT
                report_date,
                channel,
                level_1,
                level_2,
                level_3,
                budget,
                ROUND(budget * 0.27, 2) AS budget_usd,
                leads,
                SAFE_DIVIDE(budget, NULLIF(leads, 0)) AS cpl,
                ROUND(SAFE_DIVIDE(budget * 0.27, NULLIF(leads, 0)), 2) AS cpl_usd,
                no_answer_spam,
                SAFE_DIVIDE(leads - no_answer_spam, NULLIF(leads, 0)) AS rate_answer,
                qualified_leads,
                SAFE_DIVIDE(budget, NULLIF(qualified_leads, 0)) AS cost_per_qualified_leads,
                ROUND(SAFE_DIVIDE(budget * 0.27, NULLIF(qualified_leads, 0)), 2) AS cost_per_qualified_leads_usd,
                SAFE_DIVIDE(qualified_leads, NULLIF(leads, 0)) AS cr_ql,
                ql_actual,
                SAFE_DIVIDE(budget, NULLIF(ql_actual, 0)) AS cpql_actual,
                ROUND(SAFE_DIVIDE(budget * 0.27, NULLIF(ql_actual, 0)), 2) AS cpql_actual_usd,
                meetings,
                SAFE_DIVIDE(budget, NULLIF(meetings, 0)) AS cp_meetings,
                ROUND(SAFE_DIVIDE(budget * 0.27, NULLIF(meetings, 0)), 2) AS cp_meetings_usd,
                deals,
                SAFE_DIVIDE(budget, NULLIF(deals, 0)) AS cost_per_deal,
                ROUND(SAFE_DIVIDE(budget * 0.27, NULLIF(deals, 0)), 2) AS cost_per_deal_usd,
                revenue,
                ROUND(revenue * 0.27, 2) AS revenue_usd,
                SAFE_DIVIDE(revenue, NULLIF(budget, 0)) AS roi,
                company_revenue,
                ROUND(company_revenue * 0.27, 2) AS company_revenue_usd,
                99 AS sort_order,
                CURRENT_TIMESTAMP() AS refreshed_at
            FROM total_rows
        )
        SELECT *
        FROM final_rows
    `;

    await bq.query(query);
    console.log(`SUCCESS: ${TABLE_ID} refreshed.`);
}

createUnifiedMarketingDrilldownDaily().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
