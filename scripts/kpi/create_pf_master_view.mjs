import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const credentials = process.env.GOOGLE_AUTH_JSON ? JSON.parse(process.env.GOOGLE_AUTH_JSON) : undefined;

const bq = new BigQuery({
    projectId: PROJECT_ID,
    credentials,
    keyFilename: !credentials ? SERVICE_ACCOUNT_FILE : undefined,
    location: 'europe-central2'
});

async function createPFView() {
    console.log('--- REBUILDING PF MATCHING (PHONE ONLY) ---');

    const tableQuery = `
        CREATE OR REPLACE VIEW \`${PROJECT_ID}.${DATASET_ID}.pf_efficacy_master\` AS
        WITH pf_raw AS (
            SELECT
                CAST(id AS STRING) AS pf_lead_id,
                created_at AS pf_created_at,
                customer_phone,
                REGEXP_REPLACE(COALESCE(customer_phone, ''), r'[^0-9]', '') AS clean_phone,
                source AS pf_source,
                LOWER(COALESCE(type, '')) AS pf_type,
                CAST(listing_ref AS STRING) AS listing_ref,
                pf_category
            FROM \`${PROJECT_ID}.${DATASET_ID}.pf_leads_raw\`
            WHERE customer_phone IS NOT NULL
              AND LENGTH(REGEXP_REPLACE(COALESCE(customer_phone, ''), r'[^0-9]', '')) >= 9
        ),
        amo_phone_map AS (
            SELECT DISTINCT
                CAST(lead_id AS INT64) AS lead_id,
                REGEXP_REPLACE(COALESCE(phone, ''), r'[^0-9]', '') AS clean_phone
            FROM \`${PROJECT_ID}.${DATASET_ID}.amo_lead_phones\`
            WHERE phone IS NOT NULL
              AND LENGTH(REGEXP_REPLACE(COALESCE(phone, ''), r'[^0-9]', '')) >= 9
        ),
        amo_latest AS (
            SELECT
                CAST(lead_id AS INT64) AS lead_id,
                status_id,
                price,
                created_at AS crm_created_at,
                updated_at,
                source_label
            FROM \`${PROJECT_ID}.${DATASET_ID}.amo_channel_leads_raw\`
            WHERE source_label LIKE '%Property%'
            QUALIFY ROW_NUMBER() OVER (
                PARTITION BY lead_id
                ORDER BY updated_at DESC, created_at DESC
            ) = 1
        ),
        candidates AS (
            SELECT
                p.pf_lead_id,
                a.lead_id,
                a.status_id,
                a.price,
                a.crm_created_at,
                ROW_NUMBER() OVER (
                    PARTITION BY p.pf_lead_id
                    ORDER BY ABS(TIMESTAMP_DIFF(p.pf_created_at, a.crm_created_at, MINUTE)) ASC, a.crm_created_at DESC
                ) AS rn
            FROM pf_raw p
            JOIN amo_phone_map m
              ON RIGHT(p.clean_phone, 9) = RIGHT(m.clean_phone, 9)
            JOIN amo_latest a
              ON a.lead_id = m.lead_id
        )
        SELECT
            p.pf_created_at,
            p.customer_phone,
            p.pf_source,
            p.pf_type,
            p.listing_ref,
            CONCAT('https://www.propertyfinder.ae/en/search?q=', p.listing_ref) AS listing_link,
            CASE
                WHEN LOWER(COALESCE(p.pf_category, '')) LIKE '%rent%' THEN 'Rent'
                WHEN LOWER(COALESCE(p.pf_category, '')) LIKE '%sale%' THEN 'Sale'
                WHEN LOWER(COALESCE(p.pf_category, '')) LIKE '%project%' THEN 'project'
                ELSE 'Unknown'
            END AS pf_deal_type,
            c.lead_id AS crm_lead_id,
            CASE
                WHEN c.lead_id IS NOT NULL THEN CONCAT('https://reforyou.amocrm.ru/leads/detail/', CAST(c.lead_id AS STRING))
                ELSE NULL
            END AS crm_link,
            c.status_id AS crm_status_id,
            CASE
                WHEN c.status_id = 143 THEN 'Junk'
                WHEN c.status_id IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586,
                                     74717798, 74717802, 70457490, 82310010) THEN 'Qualified'
                WHEN c.status_id IS NULL THEN 'Unmatched'
                ELSE 'New'
            END AS qual_category,
            IF(c.status_id IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586,
                               74717798, 74717802, 70457490, 82310010), 1, 0) AS is_qualified,
            IF(p.pf_type LIKE '%whatsapp%', 1, 0) AS is_whatsapp,
            IF(p.pf_type LIKE '%call%', 1, 0) AS is_call,
            c.price AS potential_value
        FROM pf_raw p
        LEFT JOIN candidates c
          ON c.pf_lead_id = p.pf_lead_id
         AND c.rn = 1
    `;

    await bq.query(tableQuery);

    const statsQuery = `
        SELECT
            COUNT(*) AS total_pf_rows,
            COUNTIF(crm_lead_id IS NOT NULL) AS matched_by_phone,
            COUNTIF(crm_lead_id IS NULL) AS unmatched,
            ROUND(COUNTIF(crm_lead_id IS NOT NULL) * 100.0 / COUNT(*), 2) AS match_rate_pct
        FROM \`${PROJECT_ID}.${DATASET_ID}.pf_efficacy_master\`
    `;
    const [stats] = await bq.query(statsQuery);
    console.log('SUCCESS: pf_efficacy_master view rebuilt with strict phone matching.');
    console.table(stats);
}

createPFView().catch(console.error);
