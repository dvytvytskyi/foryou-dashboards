import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function createView() {
    console.log('--- CREATING FINAL RED EFFICACY VIEW ---');

    const viewQuery = `
        CREATE OR REPLACE VIEW \`${PROJECT_ID}.${DATASET_ID}.red_efficacy_master\` AS
        WITH red_raw AS (
            SELECT 
                lead_id, 
                MIN(date) as sheet_date, 
                MAX(tab_source) as tab_source,
                MAX(utm_source) as utm_source,
                MAX(utm_campaign) as utm_campaign,
                MAX(utm_medium) as utm_medium,
                MAX(utm_content) as utm_content,
                MAX(status_sheet) as sheet_status
            FROM \`${PROJECT_ID}.${DATASET_ID}.red_leads_raw\`
            GROUP BY lead_id
        ),
        amo_leads AS (
            SELECT 
                lead_id,
                name as lead_name,
                status_id,
                price as potential_value,
                created_at as crm_created_at,
                closed_at as crm_closed_at
            FROM \`${PROJECT_ID}.${DATASET_ID}.leads_all_history_full\`
            QUALIFY ROW_NUMBER() OVER(PARTITION BY lead_id ORDER BY created_at DESC) = 1
        ),
        loss_data AS (
            SELECT 
                lead_id,
                loss_reason_id,
                loss_reason_name
            FROM \`${PROJECT_ID}.${DATASET_ID}.leads_loss_reasons\`
            QUALIFY ROW_NUMBER() OVER(PARTITION BY lead_id ORDER BY updated_at DESC) = 1
        )
        SELECT 
            r.lead_id,
            r.sheet_date,
            r.tab_source,
            r.utm_source,
            r.utm_campaign,
            r.utm_medium,
            r.utm_content,
            a.lead_name,
            a.status_id,
            a.potential_value,
            a.crm_created_at,
            DATE_DIFF(
                COALESCE(CAST(a.crm_closed_at AS DATE), CURRENT_DATE()),
                CAST(a.crm_created_at AS DATE),
                DAY
            ) as lead_age,
            CASE 
                -- Map Statuses
                WHEN a.status_id = 70457466 THEN 'Квалификация пройдена'
                WHEN a.status_id = 142 THEN 'Квартира оплачена (Win)'
                WHEN a.status_id = 143 THEN 'Закрыто и не реализовано'
                WHEN a.status_id = 70457442 THEN 'Неразобранное'
                WHEN a.status_id = 70457446 THEN 'ЗАЯВКА ПОЛУЧЕНА'
                WHEN a.status_id = 70697150 THEN 'ЗАЯВКА ВЗЯТА В РАБОТУ'
                ELSE 'В воронке'
            END as crm_status_name,
            CASE 
                WHEN a.status_id = 143 THEN 'Junk'
                WHEN a.status_id IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586) THEN 'Qualified'
                ELSE 'New'
            END as qual_category,
            l.loss_reason_id,
            COALESCE(l.loss_reason_name, 'Не указана') as loss_reason_name
        FROM red_raw r
        LEFT JOIN amo_leads a ON r.lead_id = a.lead_id
        LEFT JOIN loss_data l ON r.lead_id = l.lead_id
    `;

    await bq.query(viewQuery);
    console.log('SUCCESS: red_efficacy_master created.');
}

createView().catch(console.error);
