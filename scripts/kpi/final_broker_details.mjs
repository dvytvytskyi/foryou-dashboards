import fs from 'fs';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const domain = 'reforyou.amocrm.ru';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: SERVICE_ACCOUNT_FILE
});

async function syncBrokerDetails() {
    console.log('--- SYNCING BROKER DETAILS (TOUCHES + LINKS) ---');
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    // 1. Fetch Events for the last 180 days (Capture OLD leads activity)
    const halfYearAgo = Math.floor((Date.now() - 180 * 24 * 60 * 60 * 1000) / 1000);
    let events = [];
    let nextEventsUrl = `https://${domain}/api/v4/events?limit=250&filter[created_at][from]=${halfYearAgo}`;
    
    console.log('Fetching 180 days of activity for deep audit...');
    for (let page = 0; page < 80; page++) { // Up to 20k events
        const res = await fetch(nextEventsUrl, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        const data = await res.json();
        if (!data._embedded?.events) break;
        events = events.concat(data._embedded.events);
        if (page % 10 === 0) console.log(`Events: ${events.length}...`);
        if (!data._links?.next) break;
        nextEventsUrl = data._links.next.href;
    }

    // 2. Map Touches (Expanded types)
    const touchMap = {};
    events.forEach(e => {
        if ([
            'note_added', 'call_in', 'call_out', 
            'message_sent', 'outgoing_chat_message', 'outgoing_message'
        ].includes(e.type)) {
            touchMap[e.entity_id] = (touchMap[e.entity_id] || 0) + 1;
        }
    });

    // 3. Fetch Lost Leads (Status 143) - Paginated for last 1000 leads
    let lostLeads = [];
    let nextLeadsUrl = `https://${domain}/api/v4/leads?filter[statuses][0][status_id]=143&limit=250&order[closed_at]=desc`;
    
    console.log('Fetching Historical Lost Leads...');
    for (let page = 0; page < 8; page++) { // Up to 2k lost leads
        const res = await fetch(nextLeadsUrl, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        const data = await res.json();
        const pageLeads = data._embedded?.leads || [];
        lostLeads = lostLeads.concat(pageLeads);
        console.log(`Lost leads batch ${page + 1}: Total ${lostLeads.length}`);
        if (!data._links?.next) break;
        nextLeadsUrl = data._links.next.href;
    }

    // 4. Map Users
    const usersRes = await fetch(`https://${domain}/api/v4/users`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const usersData = await usersRes.json();
    const usersMap = {};
    usersData._embedded?.users?.forEach(u => usersMap[u.id] = u.name);

    // 5. Prepare rows for BQ
    const bqRows = lostLeads.map(l => {
        const touches = touchMap[l.id] || 0;
        return {
            lead_id: l.id,
            lead_name: (l.name || 'No Name'),
            broker_name: (usersMap[l.responsible_user_id] || 'Unknown'),
            touches: touches,
            is_compliant: touches >= 6,
            crm_url: `https://${domain}/leads/detail/${l.id}`,
            closed_date: bq.date(new Date(l.closed_at * 1000).toISOString().split('T')[0])
        };
    });

    const datasetId = 'foryou_analytics';
    const tableId = 'broker_lost_leads_deep';

    // Ensure table exists with correct schema
    const schema = [
        { name: 'lead_id', type: 'INT64' },
        { name: 'lead_name', type: 'STRING' },
        { name: 'broker_name', type: 'STRING' },
        { name: 'touches', type: 'INT64' },
        { name: 'is_compliant', type: 'BOOL' },
        { name: 'crm_url', type: 'STRING' },
        { name: 'closed_date', type: 'DATE' }
    ];

    try {
        const table = bq.dataset(datasetId).table(tableId);
        const [exists] = await table.exists();
        
        if (!exists) {
            await bq.dataset(datasetId).createTable(tableId, { schema });
            console.log(`Table ${tableId} created. Waiting 5s...`);
            await new Promise(r => setTimeout(r, 5000));
        } else {
            // Clear table without deleting it
            await bq.query(`DELETE FROM \`crypto-world-epta.${datasetId}.${tableId}\` WHERE TRUE`);
            console.log(`Table ${tableId} cleared.`);
        }
        
        const finalTable = bq.dataset(datasetId).table(tableId);
        for (let i = 0; i < bqRows.length; i += 500) {
            const chunk = bqRows.slice(i, i + 500);
            await finalTable.insert(chunk);
            console.log(`Chunk ${i / 500 + 1} inserted (${chunk.length} rows)`);
        }
    } catch (e) {
        console.error('BQ Error:', JSON.stringify(e, null, 2));
    }
    console.log('SUCCESS: Detailed Lost Leads synced via SDK.');

    // 6. Final Dashboard View for Detailed Broker Page
    const viewQuery = `
        CREATE OR REPLACE VIEW \`crypto-world-epta.foryou_analytics.broker_detailed_master\` AS
        WITH hist AS (
            SELECT 
                broker_name,
                COUNT(*) as total_deals_all_time,
                SUM(gross) as total_revenue_all_time
            FROM \`crypto-world-epta.foryou_analytics.deals_performance_detailed\`
            GROUP BY 1
        ),
        current_perf AS (
            SELECT 
                p.broker_name,
                p.month_date as month,
                p.fact_leads,
                p.plan_leads,
                p.fact_revenue,
                p.plan_revenue,
                p.leads_percent,
                p.revenue_percent,
                b.avg_sla_min
            FROM \`crypto-world-epta.foryou_analytics.plan_fact_summary\` p
            LEFT JOIN \`crypto-world-epta.foryou_analytics.broker_weekly_dashboard\` b ON p.broker_name = b.broker_name AND p.month_date = b.week_start
        )
        SELECT 
            c.broker_name,
            c.month,
            c.fact_leads,
            c.plan_leads,
            c.fact_revenue,
            c.plan_revenue,
            c.leads_percent,
            c.revenue_percent,
            c.avg_sla_min,
            h.total_deals_all_time,
            h.total_revenue_all_time
        FROM current_perf c
        LEFT JOIN hist h ON c.broker_name = h.broker_name
    `;
    await bq.query(viewQuery);
    console.log('SUCCESS: Detailed Master View Updated.');
}

syncBrokerDetails().catch(console.error);
