
import fs from 'fs';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';
import { CLOSED_DEAL_STATUS_IDS } from '../../src/lib/crmRules.js';

const AMO_DOMAIN = 'reforyou.amocrm.ru';
const RED_PIPELINE_ID = 8696950;
const TOKENS_FILE = path.resolve(process.cwd(), 'secrets/amo_tokens.json');
const BQ_KEY_FILE = path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE,
});

const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'marketing_channel_drilldown_daily';

// Status mappings for RED (8696950)
const QUALIFIED_STATUS_IDS = [70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802, 142];
const MEETING_STATUS_IDS = [70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802, 142];
const WON_STATUS_IDS = new Set(CLOSED_DEAL_STATUS_IDS);
const LOST_STATUS_ID = 143;
const QL_ACTUAL_STATUS_IDS = [70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802];

async function fetchAllLeads(accessToken) {
    let allLeads = [];
    let page = 1;
    const limit = 250;
    
    while (true) {
        console.log(`Fetching page ${page}...`);
        const url = `https://${AMO_DOMAIN}/api/v4/leads?filter[pipeline_id]=${RED_PIPELINE_ID}&limit=${limit}&page=${page}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (res.status === 204) break;
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`AmoCRM error RED page ${page}: ${err}`);
        }
        
        const data = await res.json();
        const leads = data?._embedded?.leads || [];
        if (leads.length === 0) break;
        
        allLeads = allLeads.concat(leads);
        page++;
        if (leads.length < limit) break;
    }
    
    return allLeads;
}

function getUTM(lead, utmType) {
    const field = lead.custom_fields_values?.find(f => f.field_code === `UTM_${utmType.toUpperCase()}`);
    return field?.values[0]?.value || null;
}

async function syncRed() {
    console.log('--- 🚀 RED SYNC STARTED (with Drilldown) ---');
    
    const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    const leads = await fetchAllLeads(tokens.access_token);
    console.log(`Total RED leads fetched: ${leads.length}`);
    
    const groupedData = {}; // keyed by date|level_1|level_2|level_3
    
    for (const lead of leads) {
        const date = new Date(lead.created_at * 1000).toISOString().split('T')[0];
        const l1 = getUTM(lead, 'source');
        const l2 = getUTM(lead, 'medium');
        const l3 = getUTM(lead, 'campaign'); // Campaign is level 3 in my previous inspection
        
        const groupKey = `${date}|${l1}|${l2}|${l3}`;
        
        if (!groupedData[groupKey]) {
            groupedData[groupKey] = {
                report_date: date,
                level_1: l1,
                level_2: l2,
                level_3: l3,
                leads: 0,
                no_answer_spam: 0,
                qualified_leads: 0,
                ql_actual: 0,
                meetings: 0,
                deals: 0,
                revenue: 0,
            };
        }
        
        const g = groupedData[groupKey];
        g.leads += 1;
        
        if (lead.status_id === LOST_STATUS_ID) {
            g.no_answer_spam += 1;
        }
        
        if (QUALIFIED_STATUS_IDS.includes(lead.status_id)) {
            g.qualified_leads += 1;
        }
        
        if (QL_ACTUAL_STATUS_IDS.includes(lead.status_id)) {
            g.ql_actual += 1;
        }
        
        if (MEETING_STATUS_IDS.includes(lead.status_id)) {
            g.meetings += 1;
        }
        
        if (WON_STATUS_IDS.has(lead.status_id)) {
            g.deals += 1;
            g.revenue += (lead.price || 0);
        }
    }
    
    const FIXED_CPL_USD = 58;
    const AED_PER_USD = 3.6725;
    const FIXED_CPL_AED = FIXED_CPL_USD * AED_PER_USD;

    const bqRows = Object.values(groupedData).map(g => {
        const budget = g.leads * FIXED_CPL_AED;
        const roi = budget > 0 ? (g.revenue / budget) : 0;
        const rate_answer = g.leads > 0 ? (g.leads - g.no_answer_spam) / g.leads : 0;
        
        return {
            report_date: g.report_date,
            channel: 'RED',
            level_1: g.level_1,
            level_2: g.level_2,
            level_3: g.level_3,
            budget: budget,
            leads: g.leads,
            cpl: FIXED_CPL_AED,
            no_answer_spam: g.no_answer_spam,
            rate_answer: rate_answer,
            qualified_leads: g.qualified_leads,
            cost_per_qualified_leads: g.qualified_leads > 0 ? (budget / g.qualified_leads) : 0,
            cr_ql: g.leads > 0 ? g.qualified_leads / g.leads : 0,
            ql_actual: g.ql_actual,
            cpql_actual: g.ql_actual > 0 ? (budget / g.ql_actual) : 0,
            meetings: g.meetings,
            cp_meetings: g.meetings > 0 ? (budget / g.meetings) : 0,
            deals: g.deals,
            cost_per_deal: g.deals > 0 ? (budget / g.deals) : 0,
            revenue: g.revenue,
            roi: roi,
            company_revenue: null,
            sort_order: 1
        };
    });
    
    console.log(`Preparing to upload ${bqRows.length} RED drilldown rows to BigQuery...`);
    
    console.log('Cleaning existing RED data from BQ...');
    await bq.query({
        query: `DELETE FROM \`crypto-world-epta.foryou_analytics.marketing_channel_drilldown_daily\` WHERE channel = 'RED'`
    });
    
    if (bqRows.length > 0) {
        // Splitting into chunks if too many rows for one request
        const chunkSize = 500;
        for (let i = 0; i < bqRows.length; i += chunkSize) {
            const chunk = bqRows.slice(i, i + chunkSize);
            await bq.dataset(DATASET_ID).table(TABLE_ID).insert(chunk);
            console.log(`Uploaded chunk ${i / chunkSize + 1}`);
        }
        console.log('--- ✅ RED DRILLDOWN SYNC COMPLETE! ---');
    } else {
        console.log('No RED data to upload.');
    }
}

syncRed().catch(console.error);
