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

async function createGeoCreativeView() {
    console.log('--- REFRESHING AD HUB VIEW WITH ADMIN RLS ---');

    const viewQuery = `
        CREATE OR REPLACE VIEW \`${PROJECT_ID}.${DATASET_ID}.marketing_geo_creative_hub\` AS
        WITH combined_leads AS (
            -- RED LEADS
            SELECT 
                r.lead_id,
                r.date as lead_date,
                r.utm_source,
                r.utm_campaign,
                r.utm_content as creative_name,
                r.ip_location as ip_country,
                p.phone as raw_phone,
                'RED' as channel_source
            FROM \`${PROJECT_ID}.${DATASET_ID}.red_leads_raw\` r
            LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.amo_lead_phones\` p ON r.lead_id = p.lead_id
            
            UNION ALL
            
            -- PROPERTY FINDER LEADS
            SELECT 
                CAST(crm_lead_id AS INT64) as lead_id,
                CAST(pf_created_at AS STRING) as lead_date,
                'Property Finder' as utm_source,
                pf_deal_type as utm_campaign,
                listing_ref as creative_name,
                'AE' as ip_country,
                customer_phone as raw_phone,
                'PF' as channel_source
            FROM \`${PROJECT_ID}.${DATASET_ID}.pf_efficacy_master\`
            WHERE crm_lead_id IS NOT NULL
        ),
        leads_with_phone_geo AS (
            SELECT 
                *,
                COALESCE(
                    CASE 
                        WHEN REGEXP_CONTAINS(raw_phone, r'^\+971|^971') THEN 'AE'
                        WHEN REGEXP_CONTAINS(raw_phone, r'^\+7|^7') THEN 'RU/KZ'
                        WHEN REGEXP_CONTAINS(raw_phone, r'^\+380|^380') THEN 'UA'
                        ELSE NULL 
                    END,
                    ip_country,
                    'Other'
                ) as phone_country
            FROM combined_leads
        ),
        crm_stats AS (
            SELECT 
                lead_id,
                status_id,
                price
            FROM \`${PROJECT_ID}.${DATASET_ID}.leads_all_history_full\`
            QUALIFY ROW_NUMBER() OVER(PARTITION BY lead_id ORDER BY created_at DESC) = 1
        ),
        base_data AS (
            SELECT 
                l.*,
                s.status_id,
                s.price as potential_value,
                CASE 
                    WHEN l.channel_source = 'RED' THEN 'yt_agency@foryou.ae' 
                    WHEN l.channel_source = 'PF' THEN 'pf_agency@foryou.ae'
                    ELSE 'admin@foryou.ae'
                END as original_contractor_email
            FROM leads_with_phone_geo l
            LEFT JOIN crm_stats s ON l.lead_id = s.lead_id
        ),
        rls_multiplexed AS (
            -- Standard 
            SELECT *, original_contractor_email as contractor_email FROM base_data
            UNION ALL
            -- Admins
            SELECT *, 'dmytro@foryou-realestate.com' as contractor_email FROM base_data
            UNION ALL
            -- Admin 2
            SELECT *, 'dvytvytskiy@gmail.com' as contractor_email FROM base_data
            UNION ALL
            -- Admin 3
            SELECT *, 'm.pervushkin@foryou-realestate.com' as contractor_email FROM base_data
            UNION ALL
            -- Internal API admin
            SELECT *, 'foryou@crypto-world-epta.iam.gserviceaccount.com' as contractor_email FROM base_data
        )
        SELECT * EXCEPT(original_contractor_email) FROM rls_multiplexed
    `;

    await bq.query(viewQuery);
    console.log('SUCCESS: marketing_geo_creative_hub with Admin RLS created.');
}

createGeoCreativeView().catch(console.error);
