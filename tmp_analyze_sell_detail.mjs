import 'dotenv/config';
import fs from 'fs';

const tokens = JSON.parse(fs.readFileSync('secrets/amo_tokens.json', 'utf8'));
const AMO_DOMAIN = 'reforyou.amocrm.ru';
const RE_PIPELINE_ID = 8696950;

// Phone field ID in AMO
const PHONE_FIELD_ID = 205982;

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

const normalizePhone = (p) => p ? p.replace(/\D/g, '').slice(-10) : '';

// Fetch PF listings from Postgres to get phone numbers
console.log('Loading PF Sell leads from Postgres...');
const cs = process.env.POSTGRES_URL || 
  ('postgresql://' + encodeURIComponent(process.env.POSTGRES_USER) + 
   ':' + encodeURIComponent(process.env.POSTGRES_PASSWORD) + 
   '@' + process.env.POSTGRES_HOST + 
   ':' + (process.env.POSTGRES_PORT || '5432') + 
   '/' + process.env.POSTGRES_DB + '?sslmode=require');

const { Client } = await import('pg');
const pgClient = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await pgClient.connect();

const listingsRes = await pgClient.query(
  "SELECT payload FROM pf_listings_snapshot WHERE group_name=$1 AND category=$2 AND listing_id != $3",
  ['Our', 'Sell', 'pf-unattributed-listing-leads']
);

const pfByPhone = {};
for (const row of listingsRes.rows) {
  const payload = row.payload || {};
  const phone = normalizePhone(payload.phone);
  if (phone) {
    if (!pfByPhone[phone]) pfByPhone[phone] = [];
    pfByPhone[phone].push(payload.id);
  }
}

console.log(`Found ${Object.keys(pfByPhone).length} unique PF phone numbers\n`);
await pgClient.end();

// Fetch all AMO leads in RE pipeline
console.log('Fetching AMO leads...');
let amoLeads = [];
let page = 1;
while (amoLeads.length < 5000) {
  const resp = await fetch(
    `https://${AMO_DOMAIN}/api/v4/leads?pipeline_id=${RE_PIPELINE_ID}&limit=250&page=${page}&with=contacts,custom_fields`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  const data = await resp.json();
  const batch = data._embedded?.leads || [];
  if (!batch.length) break;
  amoLeads.push(...batch);
  page++;
}

console.log(`Fetched ${amoLeads.length} AMO leads\n`);

// Extract phone from AMO lead
function getAmoPhone(lead) {
  let phone = '';
  
  // Try custom field on lead
  if (lead.custom_fields_values) {
    const cf = lead.custom_fields_values.find(f => f.field_id === PHONE_FIELD_ID);
    if (cf?.values?.[0]?.value) {
      phone = cf.values[0].value;
    }
  }
  
  // Try contact
  if (!phone && lead._embedded?.contacts?.[0]) {
    const contact = lead._embedded.contacts[0];
    if (contact.custom_fields_values) {
      const cf = contact.custom_fields_values.find(f => f.field_id === PHONE_FIELD_ID);
      if (cf?.values?.[0]?.value) {
        phone = cf.values[0].value;
      }
    }
  }
  
  return phone;
}

// Analyze matched leads by status
const statusCounts = {};
const matchedLeads = [];

for (const lead of amoLeads) {
  const phone = getAmoPhone(lead);
  const normalized = normalizePhone(phone);
  
  if (normalized && pfByPhone[normalized]) {
    const statusId = lead.status_id;
    statusCounts[statusId] = (statusCounts[statusId] || 0) + 1;
    matchedLeads.push({
      id: lead.id,
      status_id: statusId,
      status_name: statusMap[statusId] || `Unknown (${statusId})`,
      phone: normalized
    });
  }
}

console.log(`=== Matched ${matchedLeads.length} Sell AMO leads by Status ===\n`);

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
console.log(`Other/Unknown: ${otherCnt}`);
console.log(`\nTotal: ${spamCnt + qualCnt + unqualCnt + otherCnt}`);
console.log(`Difference (should be 0): ${262 - (spamCnt + qualCnt + unqualCnt + otherCnt)}`);
