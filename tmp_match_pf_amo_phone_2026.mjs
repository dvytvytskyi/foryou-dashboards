import 'dotenv/config';
import fs from 'fs';

const PF_API_URL = 'https://atlas.propertyfinder.com/v1';
const AMO_DOMAIN = 'reforyou.amocrm.ru';
const RE_PIPELINE_ID = 8696950;
const TOKENS_PATH = 'secrets/amo_tokens.json';

const START = '2026-01-01';
const END = new Date().toISOString().slice(0, 10);

function normalizePhone(v) {
  if (!v) return null;
  const digits = String(v).replace(/\D/g, '');
  if (!digits) return null;
  // Keep canonical last 9-12 digits for cross-system matching.
  if (digits.length > 12) return digits.slice(-12);
  if (digits.length > 9) return digits.slice(-11);
  return digits;
}

function tsStart(date) {
  return Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / 1000);
}

function tsEnd(date) {
  return Math.floor(new Date(`${date}T23:59:59.000Z`).getTime() / 1000);
}

async function getPfToken() {
  const apiKey = process.env.PF_API_KEY;
  const apiSecret = process.env.PF_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('Missing PF_API_KEY/PF_API_SECRET');

  const res = await fetch(`${PF_API_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret }),
  });

  const data = await res.json();
  if (!res.ok || !data?.accessToken) {
    throw new Error(`PF token error: ${JSON.stringify(data)}`);
  }
  return data.accessToken;
}

async function fetchPfLeads2026() {
  const token = await getPfToken();
  const out = [];
  let page = 1;

  while (true) {
    if (page % 20 === 0) {
      process.stdout.write(`PF leads page ${page} (loaded ${out.length})      \r`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(`${PF_API_URL}/leads?perPage=50&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PF leads fetch failed page ${page}: ${res.status} ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const rows = data.data || data.results || [];
    if (!rows.length) break;
    out.push(...rows);
    if (!data.pagination?.nextPage) break;
    page = data.pagination.nextPage;
  }

  return out.filter((l) => String(l.createdAt || '').startsWith('2026'));
}

function loadAmoAccessToken() {
  const raw = fs.readFileSync(TOKENS_PATH, 'utf8');
  return JSON.parse(raw).access_token;
}

async function amoFetch(url, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controller.signal,
  });
  clearTimeout(timer);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AMO request failed ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchAmoLeads2026(token) {
  const from = tsStart(START);
  const to = tsEnd(END);
  const out = [];
  let page = 1;

  while (true) {
    if (page % 10 === 0) {
      process.stdout.write(`AMO leads page ${page} (loaded ${out.length})      \r`);
    }
    const url = `https://${AMO_DOMAIN}/api/v4/leads?filter[pipeline_id]=${RE_PIPELINE_ID}&filter[created_at][from]=${from}&filter[created_at][to]=${to}&limit=250&page=${page}&with=contacts`;
    const data = await amoFetch(url, token);
    const rows = data?._embedded?.leads || [];
    if (!rows.length) break;
    out.push(...rows);
    if (rows.length < 250) break;
    page += 1;
  }

  return out;
}

async function fetchAmoContactsByIds(ids, token) {
  const result = new Map();
  const chunkSize = 80;

  for (let i = 0; i < ids.length; i += chunkSize) {
    if (i % (chunkSize * 10) === 0) {
      process.stdout.write(`AMO contacts chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(ids.length / chunkSize)}      \r`);
    }
    const chunk = ids.slice(i, i + chunkSize);
    const params = new URLSearchParams();
    params.set('limit', '250');
    for (const id of chunk) params.append('filter[id][]', String(id));

    const data = await amoFetch(`https://${AMO_DOMAIN}/api/v4/contacts?${params.toString()}`, token);
    const contacts = data?._embedded?.contacts || [];

    for (const c of contacts) {
      const phones = [];
      for (const field of c.custom_fields_values || []) {
        const code = String(field.field_code || '').toUpperCase();
        const name = String(field.field_name || '').toLowerCase();
        if (code !== 'PHONE' && !name.includes('phone') && !name.includes('тел')) continue;
        for (const v of field.values || []) {
          const n = normalizePhone(v.value);
          if (n) phones.push(n);
        }
      }
      if (phones.length) result.set(Number(c.id), Array.from(new Set(phones)));
    }
  }

  return result;
}

async function main() {
  console.log(`Matching period ${START}..${END}`);
  console.log('Loading PF leads...');
  const pfLeads = await fetchPfLeads2026();
  console.log(`PF leads loaded: ${pfLeads.length}`);
  const pfPhones = new Set();
  const pfPhoneSamples = new Map();
  let pfNoPhone = 0;

  for (const l of pfLeads) {
    const p = l.sender?.contacts?.find((c) => c.type === 'phone')?.value;
    const n = normalizePhone(p);
    if (n) {
      pfPhones.add(n);
      if (!pfPhoneSamples.has(n)) {
        pfPhoneSamples.set(n, {
          normalizedPhone: n,
          rawPhone: String(p || ''),
          pfLeadId: String(l.id || ''),
          listingRef: String(l.listing?.reference || ''),
          createdAt: String(l.createdAt || ''),
        });
      }
    }
    else pfNoPhone += 1;
  }

  const amoToken = loadAmoAccessToken();
  const amoLeads = await fetchAmoLeads2026(amoToken);
  console.log(`\nAMO leads loaded: ${amoLeads.length}`);

  const contactIds = Array.from(
    new Set(
      amoLeads
        .flatMap((l) => (l._embedded?.contacts || []).map((c) => Number(c.id)))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );

  const contactPhonesMap = await fetchAmoContactsByIds(contactIds, amoToken);
  console.log(`\nAMO contacts with phones loaded: ${contactPhonesMap.size}`);
  const amoPhones = new Set();
  for (const phones of contactPhonesMap.values()) {
    for (const p of phones) amoPhones.add(p);
  }

  let matchedAmoLeads = 0;
  let matchedAmoLeadIds = new Set();
  let matchedPfPhones = new Set();
  let amoLeadsWithoutContacts = 0;

  for (const lead of amoLeads) {
    const cids = (lead._embedded?.contacts || []).map((c) => Number(c.id)).filter(Boolean);
    if (!cids.length) {
      amoLeadsWithoutContacts += 1;
      continue;
    }

    let isMatch = false;
    for (const cid of cids) {
      const phones = contactPhonesMap.get(cid) || [];
      for (const phone of phones) {
        if (pfPhones.has(phone)) {
          isMatch = true;
          matchedPfPhones.add(phone);
        }
      }
    }

    if (isMatch) {
      matchedAmoLeads += 1;
      matchedAmoLeadIds.add(Number(lead.id));
    }
  }

  const report = {
    period: { start: START, end: END },
    pf: {
      leads2026: pfLeads.length,
      uniquePhones2026: pfPhones.size,
      leadsWithoutPhone: pfNoPhone,
    },
    amo: {
      leads2026: amoLeads.length,
      leadsWithoutContacts: amoLeadsWithoutContacts,
      uniqueContactsWithPhone: contactPhonesMap.size,
    },
    matchByPhone: {
      matchedAmoLeads,
      matchedAmoLeadRatePct: Number(((matchedAmoLeads / Math.max(1, amoLeads.length)) * 100).toFixed(2)),
      matchedPfUniquePhones: matchedPfPhones.size,
      matchedPfPhoneRatePct: Number(((matchedPfPhones.size / Math.max(1, pfPhones.size)) * 100).toFixed(2)),
    },
  };

  console.log(JSON.stringify(report, null, 2));

  const unmatchedPfPhones = [];
  for (const phone of pfPhones) {
    if (!amoPhones.has(phone)) {
      unmatchedPfPhones.push(pfPhoneSamples.get(phone));
    }
  }

  console.log('\nUnmatched PF phones sample (10):');
  console.log(JSON.stringify(unmatchedPfPhones.slice(0, 10), null, 2));
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
