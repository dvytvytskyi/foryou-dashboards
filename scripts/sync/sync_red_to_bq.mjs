/**
 * sync_red_to_bq.mjs
 * Syncs RED leads (pipeline 8696950) from AmoCRM → BigQuery table `red_leads_raw`.
 * Run: node scripts/sync/sync_red_to_bq.mjs
 * Triggered by GitHub Actions every hour.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BigQuery } from '@google-cloud/bigquery';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const AMO_DOMAIN = 'reforyou.amocrm.ru';
const RE_PIPELINE_ID = 8696950;
const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'red_leads_raw';

const TOKENS_FILE = path.resolve(rootDir, 'secrets/amo_tokens.json');
const BQ_KEY_FILE = path.resolve(rootDir, 'secrets/crypto-world-epta-2db29829d55d.json');

// AmoCRM custom field IDs
const FIELD_SOURCE    = 703131; // source_label (RED_RU, RED_ENG, ...)
const FIELD_UTM_SOURCE   = 683939;
const FIELD_UTM_CAMPAIGN = 683937;
const FIELD_UTM_MEDIUM   = 683935;
const FIELD_UTM_CONTENT  = 683933;

const RED_TAGS_UPPER = new Set(['RED_RU', 'RED_ENG', 'RED_ARM', 'RED_LUX']);

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: BQ_KEY_FILE,
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getFieldValue(customFields, fieldId) {
    const f = (customFields || []).find(item => item.field_id === fieldId);
    return f?.values?.[0]?.value ?? null;
}

function detectTag(lead) {
    const tags = (lead._embedded?.tags || []).map(t => (t.name || '').toUpperCase().trim());
    const sourceLabel = (getFieldValue(lead.custom_fields_values, FIELD_SOURCE) || '').toUpperCase().trim();
    for (const tag of RED_TAGS_UPPER) {
        if (tags.includes(tag) || sourceLabel === tag) return tag;
    }
    return null;
}

async function fetchWithRetry(url, accessToken, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (res.status === 204) return { _embedded: { leads: [] } };
        if (res.status === 429) { await sleep(1500 * attempt); continue; }
        if (!res.ok) {
            const text = await res.text();
            if (attempt === retries) throw new Error(`AMO ${res.status}: ${text}`);
            await sleep(1000 * attempt);
            continue;
        }

        const text = await res.text();
        if (!text || !text.trim()) return { _embedded: { leads: [] } };
        return JSON.parse(text);
    }
    throw new Error(`AMO request failed after ${retries} retries: ${url}`);
}

async function syncRedToBq() {
    console.log('--- RED LEADS SYNC → BigQuery ---');

    const bqCredentials = process.env.GOOGLE_AUTH_JSON
        ? JSON.parse(process.env.GOOGLE_AUTH_JSON)
        : null;

    const bqClient = bqCredentials
        ? new BigQuery({ projectId: PROJECT_ID, credentials: bqCredentials })
        : bq;

    const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    const accessToken = tokens.access_token;

    // Only sync 2026 data
    const START_2026 = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);

    console.log('Fetching 2026 RED leads from pipeline', RE_PIPELINE_ID);
    const allLeads = [];
    let page = 1;

    while (true) {
        const url = `https://${AMO_DOMAIN}/api/v4/leads?filter[pipeline_id]=${RE_PIPELINE_ID}&filter[created_at][from]=${START_2026}&limit=250&page=${page}&with=tags`;
        const data = await fetchWithRetry(url, accessToken);
        const leads = data._embedded?.leads || [];
        if (!leads.length) break;
        allLeads.push(...leads);
        process.stdout.write(`  Page ${page}: ${leads.length} leads (total: ${allLeads.length})\n`);
        if (leads.length < 250) break;
        page++;
        await sleep(150);
    }

    console.log(`Total leads fetched from pipeline: ${allLeads.length}`);

    // Filter to RED leads only and build rows
    const rows = [];
    for (const lead of allLeads) {
        const tag = detectTag(lead);
        if (!tag) continue;

        const tabSource = getFieldValue(lead.custom_fields_values, FIELD_SOURCE);
        const utmSource   = getFieldValue(lead.custom_fields_values, FIELD_UTM_SOURCE);
        const utmCampaign = getFieldValue(lead.custom_fields_values, FIELD_UTM_CAMPAIGN);
        const utmMedium   = getFieldValue(lead.custom_fields_values, FIELD_UTM_MEDIUM);
        const utmContent  = getFieldValue(lead.custom_fields_values, FIELD_UTM_CONTENT);

        rows.push({
            lead_id:      lead.id,
            // date + tab_source preserved for backward compat with existing BQ views
            date:         new Date(lead.created_at * 1000).toISOString().slice(0, 10),
            tab_source:   tabSource,
            tag,
            utm_source:   utmSource,
            utm_campaign: utmCampaign,
            utm_medium:   utmMedium,
            utm_content:  utmContent,
            status_id:    lead.status_id,
            price:        lead.price || 0,
            created_at:   new Date(lead.created_at * 1000).toISOString(),
            closed_at:    lead.closed_at ? new Date(lead.closed_at * 1000).toISOString() : null,
            updated_at:   new Date(lead.updated_at * 1000).toISOString(),
            synced_at:    new Date().toISOString(),
        });
    }

    console.log(`RED leads to sync: ${rows.length}`);

    if (!rows.length) {
        console.warn('No RED leads found — skipping BQ write.');
        return;
    }

    const schema = {
        fields: [
            { name: 'lead_id',      type: 'INT64' },
            { name: 'date',         type: 'STRING' },   // YYYY-MM-DD (preserved for old views)
            { name: 'tab_source',   type: 'STRING' },
            { name: 'tag',          type: 'STRING' },   // RED_RU | RED_ENG | RED_ARM | RED_LUX
            { name: 'utm_source',   type: 'STRING' },
            { name: 'utm_campaign', type: 'STRING' },
            { name: 'utm_medium',   type: 'STRING' },
            { name: 'utm_content',  type: 'STRING' },
            { name: 'status_id',    type: 'INT64' },
            { name: 'price',        type: 'FLOAT64' },
            { name: 'created_at',   type: 'TIMESTAMP' },
            { name: 'closed_at',    type: 'TIMESTAMP' },
            { name: 'updated_at',   type: 'TIMESTAMP' },
            { name: 'synced_at',    type: 'TIMESTAMP' },
        ],
    };

    const tmpFile = '/tmp/red_leads_raw.json';
    fs.writeFileSync(tmpFile, rows.map(r => JSON.stringify(r)).join('\n'));

    const table = bqClient.dataset(DATASET_ID).table(TABLE_ID);
    await table.load(tmpFile, {
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        writeDisposition: 'WRITE_TRUNCATE',
        schema,
    });

    console.log(`SUCCESS: ${TABLE_ID} synced with ${rows.length} RED leads.`);
}

syncRedToBq().catch(err => {
    console.error('sync_red_to_bq failed:', err);
    process.exitCode = 1;
});
