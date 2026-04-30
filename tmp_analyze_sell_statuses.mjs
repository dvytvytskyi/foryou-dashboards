import 'dotenv/config';
import { Client } from 'pg';
import fs from 'fs';

const tokens = JSON.parse(fs.readFileSync('secrets/amo_tokens.json', 'utf8'));
const AMO_DOMAIN = 'reforyou.amocrm.ru';
const RE_PIPELINE_ID = 8696950;

// Status names
const statusMap = {
  70457442: 'Неразобранное',
  70457446: 'ЗАЯВКА ПОЛУЧЕНА',
  70697150: 'ЗАЯВКА ВЗЯТА В РАБОТУ',
  70457454: 'установить контакт',
  70457466: 'квалификация пройдена',
  70457470: 'презентация назначена',
  70457474: 'презентация проведена',
  70457478: 'показ назначен',
  70457482: 'EOI / чек получен',
  70457486: 'Документы подписаны',
  70757586: 'POST SALES',
  74717798: 'ПАРТНЕРЫ',
  74717802: 'ЛИСТИНГ',
  70457490: 'отложенный спрос',
  82310010: 'Реанимация',
  142: 'квартира оплачена',
  143: 'закрыто и не реализовано'
};

// Get PF token
const tokenRes = await fetch('https://atlas.propertyfinder.com/v1/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ apiKey: process.env.PF_API_KEY, apiSecret: process.env.PF_API_SECRET }),
});
const tokenData = await tokenRes.json();
const pfToken = tokenData.accessToken;

if (!pfToken) {
  console.error('Failed to get PF token');
  process.exit(1);
}

// Fetch PF Sell leads for 2026
const pfSellLeads = [];
let page = 1;
while (true) {
  const resp = await fetch(
    `https://atlas.propertyfinder.com/v1/leads?perPage=50&page=${page}`,
    { headers: { Authorization: `Bearer ${pfToken}` } }
  );
  const data = await resp.json();
  const rows = data.data || [];
  if (!rows.length) break;
  
  for (const lead of rows) {
    const d = String(lead.createdAt || '').slice(0, 10);
    const category = lead.category || lead.type;
    if (d >= '2026-01-01' && d <= '2026-12-31' && (category === 'Sale' || category === 'Sell')) {
      pfSellLeads.push(lead);
    }
  }
  if (!data.pagination?.nextPage) break;
  page = data.pagination.nextPage;
}

console.log(`\n=== PF Sell 2026: ${pfSellLeads.length} leads ===\n`);

// Build normalized phone map
const normalizePhone = (p) => p ? p.replace(/\D/g, '').slice(-10) : '';
const pfByPhone = {};
for (const lead of pfSellLeads) {
  const norm = normalizePhone(lead.phone);
  if (norm) {
    if (!pfByPhone[norm]) pfByPhone[norm] = [];
    pfByPhone[norm].push(lead.id);
  }
}

// Fetch AMO leads
let amoLeads = [];
let amoPage = 1;
while (amoLeads.length < 1000) {
  const resp = await fetch(
    `https://${AMO_DOMAIN}/api/v4/leads?pipeline_id=${RE_PIPELINE_ID}&limit=250&page=${amoPage}&with=contacts,custom_fields`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  const data = await resp.json();
  const batch = data._embedded?.leads || [];
  if (!batch.length) break;
  amoLeads.push(...batch);
  amoPage++;
}

console.log(`AMO leads in RE pipeline: ${amoLeads.length}\n`);

// Analyze matched leads by status
const statusCounts = {};
let matched = 0;

for (const lead of amoLeads) {
  // Get phone from custom field
  let phone = '';
  if (lead.custom_fields_values) {
    const cf = lead.custom_fields_values.find(f => f.field_id === 205982);
    if (cf?.values?.[0]?.value) phone = cf.values[0].value;
  }
  if (!phone && lead._embedded?.contacts?.[0]) {
    const contact = lead._embedded.contacts[0];
    if (contact.custom_fields_values) {
      const cf = contact.custom_fields_values.find(f => f.field_id === 205982);
      if (cf?.values?.[0]?.value) phone = cf.values[0].value;
    }
  }
  
  const normalized = normalizePhone(phone);
  if (normalized && pfByPhone[normalized]) {
    matched++;
    const statusId = lead.status_id;
    statusCounts[statusId] = (statusCounts[statusId] || 0) + 1;
  }
}

console.log(`=== SELL: Статуси ${matched} матчених AMO лідів ===\n`);

const sorted = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
let total = 0;
for (const [statusId, count] of sorted) {
  const name = statusMap[statusId] || `Unknown (${statusId})`;
  console.log(`  ${String(count).padStart(3)} | ${name}`);
  total += count;
}

console.log(`\n${'─'.repeat(55)}`);
console.log(`  ${String(total).padStart(3)} | TOTAL MATCHED`);

// Classify
const SPAM_STATUS = 143;
const QUALIFIED = new Set([
  70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586,
  74717798, 74717802, 70457490, 82310010, 142
]);
const UNQUALIFIED = new Set([70457442, 70457446, 70697150, 70457454]);

let spamCnt = 0, qualCnt = 0, unqualCnt = 0, otherCnt = 0;

for (const [statusId, count] of Object.entries(statusCounts)) {
  const id = Number(statusId);
  if (id === SPAM_STATUS) spamCnt += count;
  else if (QUALIFIED.has(id)) qualCnt += count;
  else if (UNQUALIFIED.has(id)) unqualCnt += count;
  else otherCnt += count;
}

console.log(`\n=== CLASSIFICATION ===`);
console.log(`No answer/Spam (143): ${spamCnt}`);
console.log(`Qualified (11 stages): ${qualCnt}`);
console.log(`Unqualified (early 4): ${unqualCnt}`);
console.log(`Other: ${otherCnt}`);
console.log(`\nSum: ${spamCnt + qualCnt + unqualCnt + otherCnt}`);
console.log(`Expected matched: 262`);
console.log(`Difference: ${262 - (spamCnt + qualCnt + unqualCnt + otherCnt)}`);
