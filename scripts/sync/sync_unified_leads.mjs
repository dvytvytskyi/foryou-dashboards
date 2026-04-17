
import fs from 'fs';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';
import { CLOSED_DEAL_STATUS_IDS } from '../../src/lib/crmRules.js';

const AMO_DOMAIN = 'reforyou.amocrm.ru';
const TOKENS_FILE = path.resolve(process.cwd(), 'secrets/amo_tokens.json');
const BQ_KEY_FILE = path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE,
});

const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'marketing_v2_leads';

const PIPELINES = {
    RED: { id: 8696950, sort: 1, fixed_cpl_usd: 58 },
    Klykov: { id: 10776450, sort: 3, commission_ratio: 0.4 },
    OKK: { id: 10633838, sort: 7 },
    OldLeads: { id: 8550470, sort: 8 },
    ConditionalReject: { id: 10651778, sort: 9 }
};

const WON_STATUS_IDS = new Set(CLOSED_DEAL_STATUS_IDS);
const LOST_STATUS_ID = 143;

// Default Status mappings (can be refined per pipeline if needed)
const STATUSES = {
    RED: {
       qualified: [70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802, 142],
       actual: [70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802],
       meetings: [70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802, 142]
    },
    Klykov: {
       qualified: [84853934, 84853938, 84853942, 84853946, 84853950, 84853954, 84853958, 84853962, 84853966, 142],
       actual: [84853934, 84853938, 84853942, 84853946, 84853950, 84853954, 84853958, 84853962, 84853966],
       meetings: [84853942, 84853946, 84853950, 84853954, 84853958, 84853962, 84853966, 142]
    }
};

async function fetchLeads(accessToken, pipelineId) {
    let allLeads = [];
    let page = 1;
    while (true) {
        const url = `https://${AMO_DOMAIN}/api/v4/leads?filter[pipeline_id]=${pipelineId}&limit=250&page=${page}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (res.status === 204) break;
        const data = await res.json();
        const leads = data?._embedded?.leads || [];
        if (leads.length === 0) break;
        allLeads = allLeads.concat(leads);
        page++;
    }
    return allLeads;
}

function getUTM(lead, utmType) {
    const field = lead.custom_fields_values?.find(f => f.field_code === `UTM_${utmType.toUpperCase()}`);
    return (field?.values[0]?.value || '').trim() || null;
}

const AED_PER_USD = 3.6725;

async function sync() {
    console.log('--- 🚀 UNIFIED SYNC STARTED ---');
    const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    const rowsBatch = [];

    for (const [channel, config] of Object.entries(PIPELINES)) {
        console.log(`Processing channel: ${channel}`);
        const leads = await fetchLeads(tokens.access_token, config.id);
        const grouped = {};

        for (const lead of leads) {
            const leadName = (lead.name || '').toLowerCase();
            const sourceLabel = (getUTM(lead, 'source') || '').toLowerCase();
            
            // Determine actual channel
            let actualChannel = channel;
            
            if (sourceLabel.includes('личный') || leadName.includes('личный') || leadName.includes('личн')) {
                actualChannel = 'Own leads';
            } else if (leadName.includes('партн') || leadName.includes('partner')) {
                actualChannel = 'Partners leads';
            } else if (leadName.includes('etc')) {
                actualChannel = 'ETC';
            }

            const date = new Date(lead.created_at * 1000).toISOString().split('T')[0];
            const utmSource = getUTM(lead, 'source');
            const l1 = utmSource || (lead.name || 'Untitled') || 'Personal Lead';
            const l2 = getUTM(lead, 'medium');
            const l3 = getUTM(lead, 'campaign');
            const key = `${date}|${actualChannel}|${l1}|${l2}|${l3}`;

            if (!grouped[key]) {
                grouped[key] = { date, channel: actualChannel, l1, l2, l3, leads: 0, lost: 0, ql: 0, ql_actual: 0, meetings: 0, deals: 0, revenue: 0 };
            }
            const g = grouped[key];
            const st = STATUSES[channel] || STATUSES.RED;
            
            g.leads++;
            if (lead.status_id === LOST_STATUS_ID) g.lost++;
            if (st.qualified.includes(lead.status_id)) g.ql++;
            if (st.actual.includes(lead.status_id)) g.ql_actual++;
            if (st.meetings.includes(lead.status_id)) g.meetings++;
            if (WON_STATUS_IDS.has(lead.status_id)) {
                g.deals++;
                g.revenue += (lead.price || 0);
            }
        }

        for (const g of Object.values(grouped)) {
            let budget = 0;
            // Budget logic: only for original marketing channels
            if (g.channel === 'RED' && config.fixed_cpl_usd) {
                budget = g.leads * config.fixed_cpl_usd * AED_PER_USD;
            } else if (g.channel === 'Klykov' && config.commission_ratio) {
                budget = g.revenue * config.commission_ratio;
            }
            // Personal leads have 0 budget in marketing report usually

            rowsBatch.push({
                report_date: g.date,
                channel: g.channel,
                level_1: g.l1,
                level_2: g.l2,
                level_3: g.l3,
                budget,
                leads: g.leads,
                cpl: g.leads > 0 ? budget / g.leads : 0,
                no_answer_spam: g.lost,
                rate_answer: g.leads > 0 ? (g.leads - g.lost) / g.leads : 0,
                qualified_leads: g.ql,
                cost_per_qualified_leads: g.ql > 0 ? budget / g.ql : 0,
                cr_ql: g.leads > 0 ? g.ql / g.leads : 0,
                ql_actual: g.ql_actual,
                cpql_actual: g.ql_actual > 0 ? budget / g.ql_actual : 0,
                meetings: g.meetings,
                cp_meetings: g.meetings > 0 ? budget / g.meetings : 0,
                deals: g.deals,
                cost_per_deal: g.deals > 0 ? budget / g.deals : 0,
                revenue: g.revenue,
                roi: budget > 0 ? g.revenue / budget : 0,
                company_revenue: null,
                sort_order: g.channel === 'RED' ? 1 : (g.channel === 'Klykov' ? 3 : 5)
            });
        }
    }

    console.log(`Total rows to upload: ${rowsBatch.length}`);
    
    const resultsJson = rowsBatch.map(r => JSON.stringify(r)).join('\n');
    const tempFile = path.resolve('/tmp/marketing_v2_leads.json');
    fs.writeFileSync(tempFile, resultsJson);

    try {
        const datasetId = DATASET_ID;
        const tableId = TABLE_ID;
        const table = bq.dataset(datasetId).table(tableId);

        await table.load(tempFile, {
            sourceFormat: 'NEWLINE_DELIMITED_JSON',
            writeDisposition: 'WRITE_TRUNCATE',
            schema: {
                fields: [
                    { name: 'report_date', type: 'DATE' },
                    { name: 'channel', type: 'STRING' },
                    { name: 'level_1', type: 'STRING' },
                    { name: 'level_2', type: 'STRING' },
                    { name: 'level_3', type: 'STRING' },
                    { name: 'budget', type: 'FLOAT' },
                    { name: 'leads', type: 'INTEGER' },
                    { name: 'cpl', type: 'FLOAT' },
                    { name: 'no_answer_spam', type: 'INTEGER' },
                    { name: 'rate_answer', type: 'FLOAT' },
                    { name: 'qualified_leads', type: 'INTEGER' },
                    { name: 'cost_per_qualified_leads', type: 'FLOAT' },
                    { name: 'cr_ql', type: 'FLOAT' },
                    { name: 'ql_actual', type: 'INTEGER' },
                    { name: 'cpql_actual', type: 'FLOAT' },
                    { name: 'meetings', type: 'INTEGER' },
                    { name: 'cp_meetings', type: 'FLOAT' },
                    { name: 'deals', type: 'INTEGER' },
                    { name: 'cost_per_deal', type: 'FLOAT' },
                    { name: 'revenue', type: 'FLOAT' },
                    { name: 'roi', type: 'FLOAT' },
                    { name: 'company_revenue', type: 'FLOAT' },
                    { name: 'sort_order', type: 'INTEGER' }
                ]
            }
        });
        console.log('--- ✅ UNIFIED SYNC COMPLETE (via Load Job)! ---');
    } catch (e) {
        console.error('Upload Error:', e.message);
    }
}

sync().catch(console.error);
