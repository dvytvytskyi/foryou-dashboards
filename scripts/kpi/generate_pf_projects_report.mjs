import fs from 'fs';
import path from 'path';

const PF_API_KEY = process.env.PF_API_KEY || '';
const PF_API_SECRET = process.env.PF_API_SECRET || '';

async function getPFToken() {
    const res = await fetch('https://atlas.propertyfinder.com/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: PF_API_KEY, apiSecret: PF_API_SECRET })
    });
    const data = await res.json();
    return data.accessToken;
}

async function fetchProjectLeads() {
    console.log('--- FETCHING PRIMARY PLUS (PROJECT) LEADS ---');
    try {
        if (!PF_API_KEY || !PF_API_SECRET) {
            throw new Error('Missing PF_API_KEY or PF_API_SECRET');
        }

        const token = await getPFToken();
        
        // 1. Fetch leads with entityType=project
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
            if (page > 20) break;
        }
        console.log(`\nFound ${allLeads.length} project leads.`);

        // 2. Fetch project details to get names and districts (PARALLEL)
        const uniqueProjIds = [...new Set(allLeads.map(l => l.project?.id).filter(Boolean))];
        const projectInfo = {};
        const locationCache = {};
        const CONCURRENCY = 10;

        console.log(`\nFetching names and districts for ${uniqueProjIds.length} projects...`);
        
        for (let i = 0; i < uniqueProjIds.length; i += CONCURRENCY) {
            const batch = uniqueProjIds.slice(i, i + CONCURRENCY);
            process.stdout.write(`Processing batch ${i / CONCURRENCY + 1}/${Math.ceil(uniqueProjIds.length / CONCURRENCY)}...\r`);
            
            await Promise.all(batch.map(async (id) => {
                try {
                    const res = await fetch(`https://atlas.propertyfinder.com/v1/projects/${id}`, {
                        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const projTitle = data.title?.en || data.name || 'Unnamed Project';
                        let district = 'Other';

                        if (data.location?.id) {
                            const locId = String(data.location.id);
                            if (locationCache[locId]) {
                                district = locationCache[locId];
                            } else {
                                try {
                                    const locRes = await fetch(`https://atlas.propertyfinder.com/v1/locations?filter[id]=${locId}`, {
                                        headers: { 
                                            'Authorization': `Bearer ${token}`, 
                                            'Accept': 'application/json',
                                            'Accept-Language': 'en'
                                        }
                                    });
                                    if (locRes.ok) {
                                        const locData = await locRes.json();
                                        const tree = locData.data?.[0]?.tree || [];
                                        if (tree.length > 1) {
                                            district = tree[1].name;
                                        } else if (tree.length === 1) {
                                            district = tree[0].name;
                                        } else {
                                            district = data.location.name?.en || 'Other';
                                        }
                                        locationCache[locId] = district;
                                    }
                                } catch (e) {
                                    // console.error(`Error resolving location ${locId}:`, e.message);
                                }
                            }
                        }

                        projectInfo[id] = {
                            name: projTitle,
                            district: district
                        };
                    }
                } catch (e) {
                    // console.error(`Error fetching project ${id}:`, e.message);
                }
            }));
        }
        console.log('\nFinished project info retrieval.');

        // 3. Group by project and month
        const report = {}; 
        
        for (const lead of allLeads) {
            const projId = lead.project?.id || 'Unknown';
            const info = projectInfo[projId] || { name: lead.project?.name || 'Unknown Project', district: 'Other' };
            const month = lead.createdAt.substring(0, 7); // YYYY-MM
            
            if (!report[projId]) {
                report[projId] = {
                    ProjectId: projId,
                    ProjectName: info.name,
                    District: info.district,
                    Reference: lead.project?.reference || String(projId),
                    Months: {}
                };
            }
            report[projId].Months[month] = (report[projId].Months[month] || 0) + 1;
        }

        // 3. Format into final structure
        const finalReport = Object.values(report).map(p => {
            const totalLeads = Object.values(p.Months).reduce((a,b)=>a+b, 0);
            return {
                Category: 'Primary Plus',
                District: p.District,
                Reference: p.Reference,
                Title: p.ProjectName,
                ProjectId: p.ProjectId,
                Leads: totalLeads,
                LeadsByMonth: p.Months,
                Budget: 0,
                BudgetByMonth: {}
            };
        });

        fs.writeFileSync('pf_projects_report.json', JSON.stringify(finalReport, null, 2));
        console.log('SUCCESS: Written pf_projects_report.json');
        console.table(finalReport.slice(0, 5));

    } catch (e) {
        console.error('ERROR:', e);
    }
}

fetchProjectLeads();
