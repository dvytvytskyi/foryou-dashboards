import fs from 'fs';
import path from 'path';

const PF_API_KEY = process.env.PF_API_KEY || ''; 
const PF_API_SECRET = process.env.PF_API_SECRET || ''; 
const JSON_FILE = path.resolve('./pf_projects_report.json');

async function getPFToken() {
    const res = await fetch('https://atlas.propertyfinder.com/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: PF_API_KEY, apiSecret: PF_API_SECRET })
    });
    const data = await res.json();
    return data.accessToken;
}

async function updateProjectsWithBudgets() {
    console.log('--- REFINING PRIMARY PLUS REPORT (TIMESTAMP PROXIMITY MATCH) ---');
    try {
        const token = await getPFToken();
        
        // 1. Fetch ALL Project Leads
        let allLeads = [];
        let page = 1;
        while (true) {
            process.stdout.write(`Fetching project leads page ${page}...\r`);
            const res = await fetch(`https://atlas.propertyfinder.com/v1/leads?perPage=50&page=${page}&entityType=project`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            if (!res.ok) break;
            const data = await res.json();
            const leads = data.data || [];
            if (leads.length === 0) break;
            allLeads.push(...leads);
            page++;
            if (page > 30) break;
        }
        console.log(`\nFetched ${allLeads.length} project leads.`);

        // 2. Fetch ALL Credits Transactions
        let allTxs = [];
        page = 1;
        while (true) {
            process.stdout.write(`Fetching credits transactions page ${page}...\r`);
            const res = await fetch(`https://atlas.propertyfinder.com/v1/credits/transactions?perPage=50&page=${page}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            if (!res.ok) break;
            const data = await res.json();
            const txs = data.data || [];
            if (txs.length === 0) break;
            allTxs.push(...txs);
            page++;
            if (page > 50) break;
        }
        console.log(`\nFetched ${allTxs.length} transactions total.`);

        // 3. Match Logic
        // We look for 'Ad Campaign' txs and match them to leads by time
        const projectBudgets = {}; // projectId -> { Total: 0, Months: {} }
        const matchedTxsCount = { total: 0, amount: 0 };

        // Convert lead times to timestamps for faster comparison
        const sortedLeads = allLeads.map(l => ({ ...l, ts: new Date(l.createdAt).getTime() })).sort((a,b) => b.ts - a.ts);
        const sortedAds = allTxs
            .filter(t => t.description === 'Ad Campaign')
            .map(t => ({ ...t, ts: new Date(t.createdAt).getTime(), abs_amount: Math.abs(t.transactionInfo.amount) }))
            .sort((a,b) => b.ts - a.ts);

        console.log(`Analyzing ${sortedAds.length} Ad Campaign transactions...`);

        for (const ad of sortedAds) {
            // Find lead that happened between 0 and 60 seconds BEFORE the transaction
            // (Property Finder Usually charges right after)
            const matchedLead = sortedLeads.find(l => {
                const diff = ad.ts - l.ts;
                return diff >= 0 && diff <= 60000; // 0 to 60 seconds
            });

            if (matchedLead) {
                const projId = matchedLead.project?.id || 'Unknown';
                const month = ad.createdAt.substring(0, 7);
                
                if (!projectBudgets[projId]) projectBudgets[projId] = { Total: 0, Months: {} };
                projectBudgets[projId].Total += ad.abs_amount;
                projectBudgets[projId].Months[month] = (projectBudgets[projId].Months[month] || 0) + ad.abs_amount;
                
                matchedTxsCount.total++;
                matchedTxsCount.amount += ad.abs_amount;
            }
        }

        console.log(`SUCCESS: Matched ${matchedTxsCount.total} transactions (${matchedTxsCount.amount} credits).`);

        // 4. Update the JSON report
        if (!fs.existsSync(JSON_FILE)) {
            console.error('Project report JSON not found. Please run generation script first.');
            return;
        }
        const pfProjects = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));

        pfProjects.forEach(p => {
            const b = projectBudgets[p.ProjectId];
            if (b) {
                p.Budget = b.Total;
                p.BudgetByMonth = b.Months;
            } else {
                p.Budget = 0;
                p.BudgetByMonth = {};
            }
        });

        fs.writeFileSync(JSON_FILE, JSON.stringify(pfProjects, null, 2));
        console.log('--- REFINEMENT COMPLETE ---');
        console.table(pfProjects.filter(p => p.Budget > 0).slice(0, 10).map(p => ({ Project: p.Title, Budget: p.Budget, Leads: p.Leads })));

    } catch (e) {
        console.error('ERROR:', e);
    }
}

updateProjectsWithBudgets();
