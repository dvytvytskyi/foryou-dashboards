
import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';

/**
 * KPI Dashboard Synchronization Engine (v1.0)
 * AMO CRM (Tasks) -> GOOGLE SHEETS
 */

const AMO_DOMAIN = 'reforyou.amocrm.ru';
const SPREADSHEET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY';
const TOKENS_FILE = path.join(process.cwd(), 'secrets/amo_tokens.json');

const FIELD_IDS = {
    TOTAL_TOUCHES: 1401351,
    FIRST_RESPONSE: 1401353,
    RULE_6_TOUCHES: 1401355
};

async function getAmoData() {
    console.log('--- 1. Reading AmoCRM Data ---');
    const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    const accessToken = tokens.access_token;

    // Fetch last 100 leads from primary pipeline
    const leadsRes = await fetch(`https://${AMO_DOMAIN}/api/v4/leads?limit=100&filter[pipeline_id]=8696950`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const leadsData = await leadsRes.json();
    const leads = leadsData?._embedded?.leads || [];
    
    const results = [];

    for (const lead of leads) {
        process.stdout.write(`Analyzing ${lead.id}... `);
        
        // Fetch completed tasks
        const tasksRes = await fetch(`https://${AMO_DOMAIN}/api/v4/tasks?filter[entity_id]=${lead.id}&filter[is_completed]=1`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        let touchTasks = [];
        if (tasksRes.status !== 204) {
            const data = await tasksRes.json();
            touchTasks = (data?._embedded?.tasks || []).filter(t => t.task_type_id === 1);
        }

        const total = touchTasks.length;
        let rt = 0;
        if (total > 0) {
            const first = touchTasks.sort((a,b) => a.updated_at - b.updated_at)[0];
            rt = Math.round((first.updated_at - lead.created_at) / 60);
        }

        results.push([
            lead.id,
            "Broker Name", // We can fetch manager names later for perfection
            total,
            rt
        ]);
        console.log(`OK (${total} touches)`);
    }
    return results;
}

async function syncToSheets(data) {
    console.log('--- 2. Connecting to Google Sheets ---');
    // NOTE: This part requires the user to have a credentials.json 
    // for local development if we use desktop OAuth.
    // Since we are in the cloud environment, we will use a slightly different approach or ask for a key.
    
    console.log('READY TO WRITE DATA:', data);
    console.log('--- PROCEED TO DATA REPLICATOR ---');
}

// Main execution
async function main() {
    try {
        const data = await getAmoData();
        await syncToSheets(data);
    } catch (e) {
        console.error('Error during sync:', e);
    }
}

main();
