import fs from 'fs';

const tokens = JSON.parse(fs.readFileSync('secrets/amo_tokens.json', 'utf8'));
const H = { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' };
const base = 'https://reforyou.amocrm.ru';

const SOURCE_FIELD_ID = 703131; // "Источник"

function norm(v) {
  return (v || '').toString().trim().toLowerCase();
}

function classifyLead(lead) {
  const tags = ((lead._embedded && lead._embedded.tags) || []).map((t) => t.name || '');
  const tagsN = tags.map(norm);
  const cfs = lead.custom_fields_values || [];

  const srcVal = cfs.find((f) => f.field_id === SOURCE_FIELD_ID)?.values?.[0]?.value || '';
  const utmVal = cfs.find((f) => f.field_code === 'UTM_SOURCE')?.values?.[0]?.value || '';
  const leadName = lead.name || '';

  const bag = [srcVal, utmVal, leadName, ...tags].map(norm).join(' | ');

  if (lead.pipeline_id === 10776450 || bag.includes('klykov')) return 'Klykov';
  if (tagsN.some((t) => ['red_ru', 'red_eng', 'red_lux', 'red_arm'].includes(t)) || bag.includes('red')) return 'Red';
  if (bag.includes('property finder') || bag.includes('pf off-plan') || bag.includes('pf offplan') || bag.includes('pf ')) return 'Property Finder';
  if (bag.includes('oman')) return 'Oman';
  if (bag.includes('facebook') || bag.includes(' fb') || bag.startsWith('fb ') || bag.includes('meta')) return 'Facebook';
  if (bag.includes('partner') || bag.includes('партнер')) return 'Partners leads';
  if (bag.includes('личный') || bag.includes('own lead') || bag.includes('own leads') || bag.includes('artem leads')) return 'Own leads';
  return 'Unmapped';
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: H });
  if (r.status === 204) return { status: 204, data: null };
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`${r.status} ${url} :: ${t.slice(0, 200)}`);
  }
  return { status: r.status, data: await r.json() };
}

async function fetchAllLeadsByPipeline(pid) {
  let page = 1;
  const limit = 250;
  const all = [];
  while (true) {
    const url = `${base}/api/v4/leads?filter[pipeline_id]=${pid}&limit=${limit}&page=${page}&with=tags`;
    const { status, data } = await fetchJson(url);
    if (status === 204) break;
    const leads = data?._embedded?.leads || [];
    if (!leads.length) break;
    all.push(...leads);
    if (leads.length < limit) break;
    page += 1;
  }
  return all;
}

const usersData = (await fetchJson(`${base}/api/v4/users?limit=250`)).data;
const users = usersData?._embedded?.users || [];
const userById = {};
users.forEach((u) => {
  userById[u.id] = u.name;
});

const [re, kl] = await Promise.all([
  fetchAllLeadsByPipeline(8696950),
  fetchAllLeadsByPipeline(10776450),
]);
const leads = [...re, ...kl];

const brokerMap = {};
for (const l of leads) {
  const rid = l.responsible_user_id;
  if (!brokerMap[rid]) {
    brokerMap[rid] = { id: rid, name: userById[rid] || 'Unknown', total: 0, re: 0, kl: 0 };
  }
  brokerMap[rid].total += 1;
  if (l.pipeline_id === 8696950) brokerMap[rid].re += 1;
  if (l.pipeline_id === 10776450) brokerMap[rid].kl += 1;
}
const brokers = Object.values(brokerMap).sort((a, b) => b.total - a.total);

const sourceCount = {
  Red: 0,
  'Property Finder': 0,
  Klykov: 0,
  Oman: 0,
  Facebook: 0,
  'Partners leads': 0,
  'Own leads': 0,
  Unmapped: 0,
  'Все источники': 0,
};

let leadsWithTags = 0;
let leadsWithSourceField = 0;
let leadsWithUtmSource = 0;
const topTags = {};

for (const l of leads) {
  sourceCount['Все источники'] += 1;
  const cls = classifyLead(l);
  sourceCount[cls] = (sourceCount[cls] || 0) + 1;

  const tags = ((l._embedded && l._embedded.tags) || []).map((t) => t.name || '').filter(Boolean);
  if (tags.length) leadsWithTags += 1;
  tags.forEach((t) => {
    topTags[t] = (topTags[t] || 0) + 1;
  });

  const cfs = l.custom_fields_values || [];
  const s = cfs.find((f) => f.field_id === SOURCE_FIELD_ID)?.values?.[0]?.value;
  const u = cfs.find((f) => f.field_code === 'UTM_SOURCE')?.values?.[0]?.value;
  if (s) leadsWithSourceField += 1;
  if (u) leadsWithUtmSource += 1;
}

const topTagsSorted = Object.entries(topTags).sort((a, b) => b[1] - a[1]).slice(0, 100);

const out = {
  totals: {
    pipelines: {
      '8696950_real_estate': re.length,
      '10776450_klykov': kl.length,
    },
    all_leads: leads.length,
    unique_brokers_with_leads: brokers.length,
    users_total_in_crm: users.length,
  },
  coverage: {
    leads_with_tags: leadsWithTags,
    leads_with_source_field_703131: leadsWithSourceField,
    leads_with_utm_source: leadsWithUtmSource,
  },
  source_distribution: sourceCount,
  brokers_all: brokers,
  top_tags: topTagsSorted,
};

console.log(JSON.stringify(out, null, 2));
