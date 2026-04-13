import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve('./.env') });

const SPREADSHEEET_ID = '1mPEF4-3vOn9Kq60IITQpKvfN0hZqX_uI6o7F8cofB6Q';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = process.env.AMO_DOMAIN || 'reforyou.amocrm.ru';

// AMO IDs
const FIELD_SOURCE = 703131;
const FIELD_COMMENT = 1343875; // Комментарий NEW
const FIELD_CEIL = 700363; // Цель покупки
const FIELD_UTM_SOURCE = 683939;
const FIELD_UTM_CAMPAIGN = 683937;
const FIELD_UTM_MEDIUM = 683935;
const FIELD_UTM_CONTENT = 683933;

async function enrichRedLeads() {
    console.log('--- ENRICHING EXISTING LEADS IN AMOCRM ---');
    
    // Auth Google
    const gAuth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = google.sheets({ version: 'v4', auth: gAuth });

    // Auth AMO
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    const tabNames = ['Leads_main', 'Leads ENG', 'Leads RU', 'Leads ARM'];
    
    for (const tabName of tabNames) {
        console.log(`Processing tab: ${tabName}...`);
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEEET_ID,
            range: `${tabName}!A2:Z2000` // Read up to 2000 rows for enrichment
        });

        const rows = res.data.values;
        if (!rows) continue;

        // Choice ID mapping
        let choiceId = 695167; // Default RED_ENG
        if (tabName === 'Leads RU') choiceId = 695165;
        if (tabName === 'Leads ARM') choiceId = 695225;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const crmUrl = row[20];
            const leadIdMatch = crmUrl?.match(/\/leads\/detail\/(\d+)/);
            
            if (leadIdMatch) {
                const leadId = leadIdMatch[1];
                
                // Formulate Comment
                const comment = `=== ДАНІ ВІД ПІДРЯДНИКА RED ===\n` +
                              `Дата: ${row[0] || ""}\n` +
                              `Ціль покупки: ${row[7] || ""}\n` +
                              `Варіанти житла: ${row[8] || ""}\n` +
                              `Зараз в Дубаї: ${row[9] || ""}\n` +
                              `Період покупки: ${row[10] || ""}\n` +
                              `Форма зв'язку: ${row[11] || ""}\n` +
                              `Формат оплати: ${row[12] || ""}\n` +
                              `Локація: ${row[18] || ""}\n` +
                              `Мова: ${row[19] || ""}\n` +
                              `Месенджери: Viber: ${row[3] || "-"}, WA: ${row[4] || "-"}, TG: ${row[5] || "-"}`;

                try {
                    const updateBody = {
                        custom_fields_values: [
                            { field_id: FIELD_SOURCE, values: [{ enum_id: choiceId }] },
                            { field_id: FIELD_UTM_SOURCE, values: [{ value: row[14] || 'RED' }] },
                            { field_id: FIELD_UTM_CAMPAIGN, values: [{ value: row[15] || '' }] },
                            { field_id: FIELD_UTM_MEDIUM, values: [{ value: row[16] || '' }] },
                            { field_id: FIELD_UTM_CONTENT, values: [{ value: row[17] || '' }] },
                            { field_id: FIELD_COMMENT, values: [{ value: comment }] },
                            { field_id: FIELD_CEIL, values: [{ value: row[7] || '' }] }
                        ]
                    };

                    const amoRes = await fetch(`https://${domain}/api/v4/leads/${leadId}`, {
                        method: 'PATCH',
                        headers: { 
                            'Authorization': `Bearer ${tokens.access_token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updateBody)
                    });

                    if (amoRes.ok) {
                        process.stdout.write('.'); // Success pulse
                    } else if (amoRes.status === 401) {
                        console.error('\nToken expired. Stop.');
                        return;
                    } else if (amoRes.status === 404) {
                        // Skip if lead not found
                    } else {
                        const err = await amoRes.text();
                        console.error(`\nFAILED Lead ${leadId}:`, amoRes.status, err);
                    }

                    // Rate limit protection
                    if (i % 5 === 0) await new Promise(r => setTimeout(r, 200));

                } catch (e) {
                    // console.error('\nError patching lead:', e.message);
                }
            }
        }
        console.log(`\nFinished tab ${tabName}`);
    }
}

enrichRedLeads().catch(console.error);
