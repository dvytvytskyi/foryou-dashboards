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
const PIРЕLINE_ID = 8696950;
const FIELD_SOURCE = 703131; // Источник
const FIELD_COMMENT = 1343875; // Комментарий NEW
const FIELD_UTM_SOURCE = 683939;
const FIELD_UTM_CAMPAIGN = 683937;
const FIELD_UTM_MEDIUM = 683935;
const FIELD_UTM_CONTENT = 683933;

async function syncRedToAmo() {
    console.log('--- SYNCING NEW RED LEADS TO AMOCRM ---');
    
    // Auth Google
    const gAuth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth: gAuth });

    // Auth AMO
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    const tabNames = ['Leads_main', 'Leads ENG', 'Leads RU'];
    
    for (const tabName of tabNames) {
        console.log(`Checking tab: ${tabName}...`);
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEEET_ID,
            range: `${tabName}!A2:Z500` // Read first 500 rows
        });

        const rows = res.data.values;
        if (!rows) continue;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const crmLink = row[20];
            const phone = row[2];
            const name = row[1] || 'RED Lead';

            // If CRM link is empty AND we have a phone
            if (!crmLink && phone) {
                console.log(`Found new lead: ${name} (${phone}) on row ${i + 2}`);
                
                try {
                    // Map Tab name to Choice ID
                    let choiceId = 695167; // Default RED_ENG
                    if (tabName === 'Leads RU') choiceId = 695165;
                    if (tabName === 'Leads ARM') choiceId = 695225;

                    // 1. Create Lead in AMO
                    const leadBody = [{
                        name: `L: ${name} (RED)`,
                        pipeline_id: PIРЕLINE_ID,
                        custom_fields_values: [
                            { field_id: FIELD_SOURCE, values: [{ enum_id: choiceId }] },
                            { field_id: FIELD_COMMENT, values: [{ value: `Goal: ${row[7] || ""}\nLocation: ${row[18] || ""}\nComment: ${row[25] || ""}` }] },
                            { field_id: FIELD_UTM_SOURCE, values: [{ value: row[14] || 'RED' }] },
                            { field_id: FIELD_UTM_CAMPAIGN, values: [{ value: row[15] || '' }] },
                            { field_id: FIELD_UTM_MEDIUM, values: [{ value: row[16] || '' }] },
                            { field_id: FIELD_UTM_CONTENT, values: [{ value: row[17] || '' }] }
                        ],
                        _embedded: {
                            contacts: [{
                                first_name: name,
                                custom_fields_values: [
                                    {
                                        field_code: 'PHONE',
                                        values: [{ value: phone, enum_code: 'WORK' }]
                                    }
                                ]
                            }]
                        }
                    }];

                    const amoRes = await fetch(`https://${domain}/api/v4/leads/complex`, {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${tokens.access_token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(leadBody)
                    });

                    if (amoRes.ok) {
                        const amoData = await amoRes.json();
                        const newLeadId = amoData[0].id;
                        const newCrmUrl = `https://${domain}/leads/detail/${newLeadId}`;
                        console.log(`SUCCESS: Created Lead ID ${newLeadId}`);

                        // 2. Write URL back to Google Sheet
                        const range = `${tabName}!U${i + 2}`; // Column 20 is 'U' (A=1, B=2... U=21 but 0-indexed 20 is 21st col)
                        await sheets.spreadsheets.values.update({
                            spreadsheetId: SPREADSHEEET_ID,
                            range: range,
                            valueInputOption: 'USER_ENTERED',
                            requestBody: { values: [[newCrmUrl]] }
                        });
                        console.log(`Updated Sheet with URL: ${newCrmUrl}`);
                    } else {
                        const err = await amoRes.text();
                        console.error('AMO CREATE FAILED:', amoRes.status, err);
                    }
                } catch (e) {
                    console.error('Error processing row:', e.message);
                }
            }
        }
    }
}

syncRedToAmo().catch(console.error);
