
import fs from 'fs';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const AMO_DOMAIN = 'reforyou.amocrm.ru';
const PIPELINE_ID = 10776450;
const TOKENS_FILE = path.resolve(process.cwd(), 'secrets/amo_tokens.json');
const BQ_KEY_FILE = path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: BQ_KEY_FILE,
});

const DATASET_ID = 'foryou_analytics';
const TABLE_ID = 'marketing_channel_drilldown_daily';

// Status mappings
const QUALIFIED_STATUS_IDS = [84853934, 84853938, 84853942, 84853946, 84853950, 84853954, 84853958, 84853962, 84853966, 142];
const MEETING_STATUS_IDS = [84853942, 84853946, 84853950, 84853954, 84853958, 84853962, 84853966, 142];
const WON_STATUS_ID = 142;
const LOST_STATUS_ID = 143;

async function fetchAllLeads(accessToken) {
    let allLeads = [];
    let page = 1;
    const limit = 250;
    
    while (true) {
        console.log(`Fetching page ${page}...`);
        const url = `https://${AMO_DOMAIN}/api/v4/leads?filter[pipeline_id]=${PIPELINE_ID}&limit=${limit}&page=${page}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (res.status === 204) break; // No more data
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`AmoCRM error page ${page}: ${err}`);
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

async function sync() {
    console.log('--- 🚀 KLYKOV SYNC STARTED ---');
    
    const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    const leads = await fetchAllLeads(tokens.access_token);
    console.log(`Total leads fetched: ${leads.length}`);
    
    const dailyData = {}; // keyed by YYYY-MM-DD
    
    for (const lead of leads) {
        const date = new Date(lead.created_at * 1000).toISOString().split('T')[0];
        if (!dailyData[date]) {
            dailyData[date] = {
                leads: 0,
                no_answer_spam: 0,
                qualified_leads: 0,
                meetings: 0,
                deals: 0,
                revenue: 0,
            };
        }
        
        const day = dailyData[date];
        day.leads += 1;
        
        if (lead.status_id === LOST_STATUS_ID) {
            day.no_answer_spam += 1;
        }
        
        if (QUALIFIED_STATUS_IDS.includes(lead.status_id)) {
            day.qualified_leads += 1;
        }
        
        if (MEETING_STATUS_IDS.includes(lead.status_id)) {
            day.meetings += 1;
        }
        
        if (lead.status_id === WON_STATUS_ID) {
            day.deals += 1;
            day.revenue += (lead.price || 0);
        }
    }
    
    const bqRows = Object.entries(dailyData).map(([date, stats]) => {
        const budget = stats.revenue * 0.4;
        const roi = stats.revenue > 0 ? (budget / stats.revenue) : 0;
        const cpl = stats.leads > 0 ? (budget / stats.leads) : 0;
        const rate_answer = stats.leads > 0 ? (stats.leads - stats.no_answer_spam) / stats.leads : 0;
        const cost_per_deal = stats.deals > 0 ? (budget / stats.deals) : 0;
        
        return {
            report_date: date,
            channel: 'Klykov',
            level_1: 'AmoCRM Pipeline',
            level_2: null,
            level_3: null,
            budget: budget,
            leads: stats.leads,
            cpl: cpl,
            no_answer_spam: stats.no_answer_spam,
            rate_answer: rate_answer,
            qualified_leads: stats.qualified_leads,
            cost_per_qualified_leads: stats.qualified_leads > 0 ? (budget / stats.qualified_leads) : 0,
            cr_ql: stats.leads > 0 ? stats.qualified_leads / stats.leads : 0,
            ql_actual: stats.qualified_leads,
            cpql_actual: stats.qualified_leads > 0 ? (budget / stats.qualified_leads) : 0,
            meetings: stats.meetings,
            cp_meetings: stats.meetings > 0 ? (budget / stats.meetings) : 0,
            deals: stats.deals,
            cost_per_deal: cost_per_deal,
            revenue: stats.revenue,
            roi: roi,
            company_revenue: stats.revenue, // assuming company revenue is the same or same field used
            sort_order: 3 // Position for Klykov
        };
    });
    
    console.log(`Preparing to upload ${bqRows.length} daily rows to BigQuery...`);
    
    // Delete existing rows for Klykov to avoid duplicates
    console.log('Cleaning existing Klykov data from BQ...');
    await bq.dataset(DATASET_ID).table(TABLE_ID).query({
        query: `DELETE FROM \`${DATASET_ID}.${TABLE_ID}\` WHERE channel = 'Klykov'`
    });
    
    if (bqRows.length > 0) {
        await bq.dataset(DATASET_ID).table(TABLE_ID).insert(bqRows);
        console.log('--- ✅ KLYKOV SYNC COMPLETE! ---');
    } else {
        console.log('No data to upload.');
    }
}

sync().catch(console.error);
