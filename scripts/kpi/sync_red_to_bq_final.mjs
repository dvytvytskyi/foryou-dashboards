import { google } from 'googleapis';
import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';
import fs from 'fs';

const SPREADSHEEET_ID = '1mPEF4-3vOn9Kq60IITQpKvfN0hZqX_uI6o7F8cofB6Q';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: SERVICE_ACCOUNT_FILE
});

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const sheets = google.sheets({ version: 'v4', auth });

async function syncRedLeads() {
    console.log('--- SYNCING RED LEADS TO BIGQUERY ---');
    
    const metadata = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEEET_ID });
    const tabsToSync = ['Leads ENG', 'Leads RU', 'Leads ARM', 'Leads_main'];
    let allLeads = [];

    for (const tabName of tabsToSync) {
        console.log(`Processing tab: ${tabName}...`);
        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEEET_ID,
                range: `${tabName}!A2:Z5000`
            });

            const rows = res.data.values;
            if (!rows) continue;

            rows.forEach(row => {
                const crmUrl = row[20] || '';
                const leadIdMatch = crmUrl.match(/\/leads\/detail\/(\d+)/);
                if (!leadIdMatch) return;

                const leadId = parseInt(leadIdMatch[1]);
                const date = row[0]; // YYYY-MM-DD usually

                allLeads.push({
                    lead_id: leadId,
                    date: date,
                    tab_source: tabName,
                    utm_source: row[14] || null,
                    utm_campaign: row[15] || null,
                    utm_medium: row[16] || null,
                    utm_content: row[17] || null,
                    ip_location: row[18] || null, // Додаємо локацію за IP
                    status_sheet: row[24] || null, 
                    updated_at: new Date().toISOString()
                });
            });
        } catch (e) {
            console.warn(`Tab ${tabName} not found or error: ${e.message}`);
        }
    }

    console.log(`Total leads extracted: ${allLeads.length}`);
    if (allLeads.length === 0) return;

    const datasetId = 'foryou_analytics';
    const tableId = 'red_leads_raw';
    const dataset = bq.dataset(datasetId);
    const table = dataset.table(tableId);

    // Update schema to include ip_location
    await table.setMetadata({
        schema: {
            fields: [
                { name: 'lead_id', type: 'INT64' },
                { name: 'date', type: 'STRING' },
                { name: 'tab_source', type: 'STRING' },
                { name: 'utm_source', type: 'STRING' },
                { name: 'utm_campaign', type: 'STRING' },
                { name: 'utm_medium', type: 'STRING' },
                { name: 'utm_content', type: 'STRING' },
                { name: 'ip_location', type: 'STRING' },
                { name: 'status_sheet', type: 'STRING' },
                { name: 'updated_at', type: 'TIMESTAMP' }
            ]
        }
    });

    // Insert data using Load Job
    console.log(`Starting Batch Load for ${allLeads.length} leads...`);
    const leadsJson = allLeads.map(l => JSON.stringify(l)).join('\n');
    const tempFile = path.resolve('/tmp/red_leads_temp.json');
    fs.writeFileSync(tempFile, leadsJson);

    await table.load(tempFile, {
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        writeDisposition: 'WRITE_TRUNCATE'
    });
    console.log('SUCCESS: RED Leads synced via Load Job.');

    // CREATE EFFICACY VIEW
    const viewQuery = `
        CREATE OR REPLACE VIEW \`crypto-world-epta.foryou_analytics.view_red_efficacy\` AS
        WITH red_leads AS (
            SELECT lead_id, MIN(date) as first_date, MAX(status_sheet) as sheet_status
            FROM \`crypto-world-epta.foryou_analytics.red_leads_raw\`
            GROUP BY lead_id
        ),
        amo_leads AS (
            SELECT 
                lead_id, 
                status_id,
                created_at,
                price
            FROM \`crypto-world-epta.foryou_analytics.leads_all_history_full\`
            QUALIFY ROW_NUMBER() OVER(PARTITION BY lead_id ORDER BY created_at DESC) = 1
        )
        SELECT 
            r.lead_id,
            r.first_date as sheet_date,
            a.created_at as crm_date,
            a.status_id,
            CASE 
                WHEN a.status_id = 143 THEN 'Junk'
                WHEN a.status_id IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586) THEN 'Qualified'
                ELSE 'New / In Progress'
            END as qual_status,
            a.price as revenue
        FROM red_leads r
        LEFT JOIN amo_leads a ON r.lead_id = a.lead_id
    `;
    await bq.query(viewQuery);
    console.log('SUCCESS: view_red_efficacy created.');
}

syncRedLeads().catch(console.error);
