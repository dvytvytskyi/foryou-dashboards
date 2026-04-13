// Fetches Primary Plus (project) leads and outputs a report similar to pf_listings_report.json
// Usage: node scripts/pf_primary_plus_leads_report.mjs
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const API_URL = process.env.PF_API_URL || 'https://api.propertyfinder.ae/v1';
const TOKEN = process.env.PF_API_TOKEN;
if (!TOKEN) throw new Error('Set PF_API_TOKEN in env');

const OUTPUT = 'pf_primary_plus_leads_report.json';
const PER_PAGE = 50;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchAllPrimaryPlusLeads({ from, to }) {
  let page = 1;
  let all = [];
  while (true) {
    const url = new URL(`${API_URL}/leads`);
    url.searchParams.set('entityType', 'project');
    url.searchParams.set('createdAtFrom', from);
    url.searchParams.set('createdAtTo', to);
    url.searchParams.set('perPage', PER_PAGE);
    url.searchParams.set('page', page);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (!data.items || data.items.length === 0) break;
    all.push(...data.items);
    if (data.items.length < PER_PAGE) break;
    page++;
    await sleep(200); // avoid rate limits
  }
  return all;
}

function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function mapLead(lead) {
  return {
    id: lead.id,
    projectId: lead.projectId || null,
    status: lead.status,
    channel: lead.channel,
    createdAt: lead.createdAt,
    assignedTo: lead.assignedTo || null,
    // add more fields as needed
  };
}

async function main() {
  // Last 3 months only (API limitation)
  const now = new Date();
  const to = now.toISOString();
  const from = new Date(now.getFullYear(), now.getMonth()-2, 1).toISOString();
  const leads = await fetchAllPrimaryPlusLeads({ from, to });
  const mapped = leads.map(mapLead);
  // Monthly breakdown
  const byMonth = {};
  for (const lead of mapped) {
    const key = monthKey(lead.createdAt);
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(lead);
  }
  const report = {
    total: mapped.length,
    byMonth,
    leads: mapped
  };
  await fs.writeFile(path.join(process.cwd(), OUTPUT), JSON.stringify(report, null, 2));
  console.log(`Report written to ${OUTPUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
