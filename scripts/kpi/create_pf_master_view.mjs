import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE,
    location: 'europe-central2'
});

async function createPFView() {
    console.log('--- REPAIRING PF VIEW (RELIABLE CATEGORIZATION) ---');

    const viewQuery = `
        CREATE OR REPLACE VIEW \`${PROJECT_ID}.${DATASET_ID}.pf_efficacy_master\` AS
        WITH pf_raw AS (
            SELECT 
                customer_name,
                customer_phone,
                REPLACE(REPLACE(REPLACE(customer_phone, ' ', ''), '+', ''), '-', '') as clean_phone,
                MIN(created_at) as pf_created_at,
                MAX(source) as pf_source,
                MAX(LOWER(type)) as pf_type,
                MAX(listing_ref) as listing_ref,
                MAX(pf_category) as pf_category
            FROM \`${PROJECT_ID}.${DATASET_ID}.pf_leads_raw\`
            WHERE customer_phone IS NOT NULL
            GROUP BY 1, 2, 3
        ),
        amo_phones AS (
            SELECT 
                lead_id,
                phone,
                MAX(updated_at) as mapping_updated_at
            FROM \`${PROJECT_ID}.${DATASET_ID}.amo_lead_phones\`
            GROUP BY 1, 2
        ),
        amo_leads AS (
            SELECT 
                l.lead_id,
                l.status_id,
                l.price,
                l.created_at as crm_created_at
            FROM \`${PROJECT_ID}.${DATASET_ID}.leads_all_history_full\` l
            QUALIFY ROW_NUMBER() OVER(PARTITION BY lead_id ORDER BY created_at DESC) = 1
        )
        SELECT 
            p.pf_created_at,
            p.customer_phone,
            p.pf_source,
            p.pf_type,
            p.listing_ref,
            CONCAT('https://www.propertyfinder.ae/en/search?q=', p.listing_ref) as listing_link,
            -- SMART CATEGORIZATION:
            CASE 
                WHEN p.pf_category = 'Sale' THEN 'Sale'
                WHEN p.pf_category = 'Rent' THEN 'Rent'
                ELSE 'Sale' -- Default to Sale
            END as pf_deal_type,
            
            -- MULTI-STAGE JOIN (Phone first, then Name+Time)
            COALESCE(m.lead_id, n.lead_id) as crm_lead_id,
            CASE 
                WHEN COALESCE(m.lead_id, n.lead_id) IS NOT NULL THEN CONCAT('https://reforyou.amocrm.ru/leads/detail/', CAST(COALESCE(m.lead_id, n.lead_id) AS STRING))
                ELSE NULL
            END as crm_link,
            
            COALESCE(a_m.status_id, a_n.status_id) as crm_status_id,
            CASE 
                WHEN COALESCE(a_m.status_id, a_n.status_id) = 143 THEN 'Junk'
                WHEN COALESCE(a_m.status_id, a_n.status_id) IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586) THEN 'Qualified'
                ELSE 'New'
            END as qual_category,
            IF(COALESCE(a_m.status_id, a_n.status_id) IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586), 1, 0) as is_qualified,
            IF(p.pf_type LIKE '%whatsapp%', 1, 0) as is_whatsapp,
            IF(p.pf_type LIKE '%call%', 1, 0) as is_call,
            COALESCE(a_m.price, a_n.price) as potential_value
        FROM pf_raw p
        LEFT JOIN amo_phones m ON p.clean_phone = m.phone
        LEFT JOIN amo_leads a_m ON m.lead_id = a_m.lead_id
        
        -- Fuzzy Name Match (if phone didn't match and name is long enough)
        LEFT JOIN (
            SELECT 
                l.lead_id, 
                l.name as amo_name,
                l.created_at as amo_at
            FROM \`${PROJECT_ID}.${DATASET_ID}.amo_channel_leads_raw\` l
            WHERE l.source_label LIKE '%Property%'
        ) n ON m.lead_id IS NULL 
           AND LENGTH(p.customer_name) > 3 
           AND (LOWER(n.amo_name) LIKE CONCAT('%', LOWER(p.customer_name), '%'))
           AND ABS(TIMESTAMP_DIFF(p.pf_created_at, n.amo_at, MINUTE)) < 120
        LEFT JOIN amo_leads a_n ON n.lead_id = a_n.lead_id
    `;

    await bq.query(viewQuery);
    console.log('SUCCESS: pf_efficacy_master REPAIRED with smart categorization.');
}

createPFView().catch(console.error);
