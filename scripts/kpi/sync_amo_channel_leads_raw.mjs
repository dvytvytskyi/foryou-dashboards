import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BigQuery } from '@google-cloud/bigquery';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'amo_channel_leads_raw';
const AMO_DOMAIN = 'reforyou.amocrm.ru';

const TOKENS_FILE = path.resolve(rootDir, 'secrets/amo_tokens.json');
const BQ_KEY_FILE = path.resolve(rootDir, 'secrets/crypto-world-epta-2db29829d55d.json');

const FIELD_SOURCE = 703131;
const FIELD_CLIENT_TYPE = 703153;
const FIELD_UTM_SOURCE = 683939;
const FIELD_UTM_CAMPAIGN = 683937;
const FIELD_UTM_MEDIUM = 683935;
const FIELD_UTM_CONTENT = 683933;
const AMO_PAGE_LIMIT = 250;
const AMO_MAX_PAGES_PER_PIPELINE = Number(process.env.AMO_MAX_PAGES_PER_PIPELINE || 120);

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: BQ_KEY_FILE
});

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFieldValue(customFields, fieldId) {
    const field = (customFields || []).find((item) => item.field_id === fieldId);
    if (!field || !field.values || field.values.length === 0) {
        return null;
    }
    return field.values[0] || null;
}

async function fetchWithRetry(url, accessToken, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt += 1) {
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        if (res.status === 204) {
            return { _embedded: { leads: [] } };
        }

        if (res.status === 429) {
            await sleep(1000 * attempt);
            continue;
        }

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`amo request failed ${res.status}: ${text}`);
        }

        const text = await res.text();
        if (!text || !text.trim()) {
            return { _embedded: { leads: [] } };
        }

        try {
            return JSON.parse(text);
        } catch {
            await sleep(500 * attempt);
            continue;
        }
    }

    throw new Error(`amo request retried and failed for ${url}`);
}

async function syncAmoChannelLeadsRaw() {
    console.log('--- SYNCING AMO CHANNEL LEADS RAW ---');

    const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    const accessToken = tokens.access_token;

    const pipelinesData = await fetchWithRetry(`https://${AMO_DOMAIN}/api/v4/leads/pipelines`, accessToken);
    const pipelines = pipelinesData?._embedded?.pipelines || [];

    if (pipelines.length === 0) {
        throw new Error('No pipelines returned from amoCRM');
    }

    const usersData = await fetchWithRetry(`https://${AMO_DOMAIN}/api/v4/users`, accessToken);
    const usersMap = {};
    (usersData?._embedded?.users || []).forEach((user) => {
        usersMap[user.id] = user.name;
    });

    const rows = [];

    for (const pipeline of pipelines) {
        let page = 1;
        let keepPaging = true;
        const seenLeadIds = new Set();

        while (keepPaging) {
            if (page > AMO_MAX_PAGES_PER_PIPELINE) {
                console.warn(
                    `WARN: pipeline ${pipeline.id} reached page cap (${AMO_MAX_PAGES_PER_PIPELINE}). Stopping pagination to avoid infinite loop.`,
                );
                break;
            }

            const url = `https://${AMO_DOMAIN}/api/v4/leads?filter[pipeline_id]=${pipeline.id}&limit=${AMO_PAGE_LIMIT}&page=${page}&with=tags`;
            const data = await fetchWithRetry(url, accessToken);
            const leads = data?._embedded?.leads || [];

            if (leads.length === 0) {
                keepPaging = false;
                break;
            }

            const newLeads = leads.filter((lead) => !seenLeadIds.has(lead.id));
            if (newLeads.length === 0) {
                console.warn(`WARN: pipeline ${pipeline.id} page ${page} returned only already-seen leads; stopping pagination.`);
                break;
            }

            newLeads.forEach((lead) => {
                seenLeadIds.add(lead.id);
                const source = getFieldValue(lead.custom_fields_values, FIELD_SOURCE);
                const clientType = getFieldValue(lead.custom_fields_values, FIELD_CLIENT_TYPE);
                const utmSource = getFieldValue(lead.custom_fields_values, FIELD_UTM_SOURCE);
                const utmCampaign = getFieldValue(lead.custom_fields_values, FIELD_UTM_CAMPAIGN);
                const utmMedium = getFieldValue(lead.custom_fields_values, FIELD_UTM_MEDIUM);
                const utmContent = getFieldValue(lead.custom_fields_values, FIELD_UTM_CONTENT);
                const tagsText = (lead._embedded?.tags || []).map((tag) => tag?.name || '').filter(Boolean).join(' | ') || null;

                rows.push({
                    lead_id: lead.id,
                    name: lead.name || 'No Name',
                    pipeline_id: lead.pipeline_id,
                    pipeline_name: pipeline.name,
                    status_id: lead.status_id,
                    responsible_user: usersMap[lead.responsible_user_id] || 'Unknown',
                    source_enum_id: source?.enum_id || null,
                    source_label: source?.value || null,
                    client_type_enum_id: clientType?.enum_id || null,
                    client_type_label: clientType?.value || null,
                    utm_source: utmSource?.value || null,
                    utm_campaign: utmCampaign?.value || null,
                    utm_medium: utmMedium?.value || null,
                    utm_content: utmContent?.value || null,
                    tags_text: tagsText,
                    price: lead.price || 0,
                    created_at: new Date(lead.created_at * 1000).toISOString(),
                    closed_at: lead.closed_at ? new Date(lead.closed_at * 1000).toISOString() : null,
                    updated_at: new Date(lead.updated_at * 1000).toISOString(),
                    synced_at: new Date().toISOString()
                });
            });

            process.stdout.write(
                `Pipeline ${pipeline.id} page ${page}, new rows: ${newLeads.length}, total rows: ${rows.length}\n`,
            );

            if (leads.length < AMO_PAGE_LIMIT) {
                break;
            }

            page += 1;
            await sleep(150);
        }
    }

    const table = bq.dataset(DATASET_ID).table(TABLE_ID);
    const schema = {
        fields: [
            { name: 'lead_id', type: 'INT64' },
            { name: 'name', type: 'STRING' },
            { name: 'pipeline_id', type: 'INT64' },
            { name: 'pipeline_name', type: 'STRING' },
            { name: 'status_id', type: 'INT64' },
            { name: 'responsible_user', type: 'STRING' },
            { name: 'source_enum_id', type: 'INT64' },
            { name: 'source_label', type: 'STRING' },
            { name: 'client_type_enum_id', type: 'INT64' },
            { name: 'client_type_label', type: 'STRING' },
            { name: 'utm_source', type: 'STRING' },
            { name: 'utm_campaign', type: 'STRING' },
            { name: 'utm_medium', type: 'STRING' },
            { name: 'utm_content', type: 'STRING' },
            { name: 'tags_text', type: 'STRING' },
            { name: 'price', type: 'FLOAT64' },
            { name: 'created_at', type: 'TIMESTAMP' },
            { name: 'closed_at', type: 'TIMESTAMP' },
            { name: 'updated_at', type: 'TIMESTAMP' },
            { name: 'synced_at', type: 'TIMESTAMP' }
        ]
    };

    const tmpFile = '/tmp/amo_channel_leads_raw.json';
    fs.writeFileSync(tmpFile, rows.map((row) => JSON.stringify(row)).join('\n'));

    await table.load(tmpFile, {
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        writeDisposition: 'WRITE_TRUNCATE',
        schema
    });

    console.log(`SUCCESS: ${TABLE_ID} synced with ${rows.length} rows.`);
}

syncAmoChannelLeadsRaw().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
