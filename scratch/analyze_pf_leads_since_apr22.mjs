/**
 * analyze_pf_leads_since_apr22.mjs
 * 
 * Аналіз лідів з Property Finder з 22 квітня 2026 р.
 * Три джерела:
 *   1. PF API — безпосередньо ліди з Property Finder
 *   2. AMO CRM — ліди з полем PF_FIELD_LEAD_ID (прийшли через міст)
 *   3. DB pf_amo_sync_state — лог нашого sync процесу
 */

import 'dotenv/config';
import pg from 'pg';

const CUTOFF = new Date('2026-04-22T00:00:00.000Z');
const CUTOFF_UNIX = Math.floor(CUTOFF.getTime() / 1000);

const AMO_DOMAIN = process.env.AMO_DOMAIN || 'reforyou.amocrm.ru';
const PF_API_URL = 'https://atlas.propertyfinder.com/v1';

const PF_FIELD_LEAD_ID = 1516909;

// ─── DB ──────────────────────────────────────────────────────────────────────

function getConnStr() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || null;
}

async function getAmoTokensFromDb() {
  const connStr = getConnStr();
  if (!connStr) throw new Error('No POSTGRES_URL');
  const pool = new pg.Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false }, max: 1 });
  try {
    const res = await pool.query(`SELECT tokens FROM integration_tokens WHERE provider = 'amo' LIMIT 1`);
    const t = res.rows[0]?.tokens;
    if (!t?.access_token) throw new Error('No AMO token in DB');
    return t;
  } finally {
    await pool.end();
  }
}

// ─── PF API ───────────────────────────────────────────────────────────────────

async function getPfToken() {
  const apiKey = process.env.PF_API_KEY;
  const apiSecret = process.env.PF_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('Missing PF_API_KEY or PF_API_SECRET in .env');

  const res = await fetch(`${PF_API_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret }),
  });
  const data = await res.json();
  if (!res.ok || !data?.accessToken) throw new Error(`PF auth failed: ${JSON.stringify(data)}`);
  return data.accessToken;
}

async function fetchPfLeadsSinceApr22() {
  console.log('\n═══ 1. PROPERTY FINDER API ═══');
  console.log(`Завантаження лідів з ${CUTOFF.toISOString()}...`);

  let token;
  try {
    token = await getPfToken();
    console.log('✓ PF auth OK');
  } catch (e) {
    console.log(`✗ PF auth FAILED: ${e.message}`);
    return null;
  }

  const allLeads = [];
  let page = 1;
  const MAX_PAGES = 200;
  let stoppedEarly = false;

  while (page <= MAX_PAGES) {
    const res = await fetch(`${PF_API_URL}/leads?perPage=50&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const data = await res.json();

    if (!res.ok) {
      console.log(`✗ PF leads page ${page} error: ${JSON.stringify(data)}`);
      break;
    }

    const rows = data.data || data.results || [];
    if (!rows.length) { console.log(`  Page ${page}: empty — зупиняємось`); break; }

    let olderCount = 0;
    for (const lead of rows) {
      const createdAt = new Date(lead?.createdAt || 0);
      if (createdAt >= CUTOFF) {
        allLeads.push(lead);
      } else {
        olderCount++;
      }
    }

    console.log(`  Page ${page}: ${rows.length} лідів, ${rows.length - olderCount} >= 22 квітня, ${olderCount} старіших`);

    if (olderCount === rows.length) { stoppedEarly = true; break; }
    if (!data.pagination?.nextPage) break;
    page = data.pagination.nextPage;
  }

  console.log(`\n📊 PF API — всього лідів >= 22 квітня: ${allLeads.length}`);

  // Групуємо по даті
  const byDate = {};
  for (const l of allLeads) {
    const d = (l.createdAt || '').slice(0, 10);
    byDate[d] = (byDate[d] || 0) + 1;
  }
  console.log('\nПо датам:');
  for (const [d, cnt] of Object.entries(byDate).sort()) {
    console.log(`  ${d}: ${cnt} лідів`);
  }

  // Тип ліду (listing vs project)
  const listingLeads = allLeads.filter(l => (l.entityType || '').toLowerCase() !== 'project');
  const projectLeads = allLeads.filter(l => (l.entityType || '').toLowerCase() === 'project');
  console.log(`\n  Listing leads: ${listingLeads.length}`);
  console.log(`  Project leads: ${projectLeads.length}`);

  // Перші 5 для прикладу
  if (allLeads.length > 0) {
    console.log('\nПриклади (перші 5):');
    allLeads.slice(0, 5).forEach(l => {
      console.log(`  [${l.id}] ${l.createdAt} type=${l.entityType} listing=${l.listing?.reference || l.project?.id || 'n/a'}`);
    });
  }

  return allLeads;
}

// ─── AMO CRM ─────────────────────────────────────────────────────────────────

async function fetchAmoLeadsSinceApr22(amoTokens) {
  console.log('\n═══ 2. AMO CRM ═══');
  console.log(`Пошук лідів з полем PF_LEAD_ID (${PF_FIELD_LEAD_ID}) або created_at >= 22 квітня...`);

  const headers = {
    Authorization: `Bearer ${amoTokens.access_token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const allLeads = [];
  let page = 1;
  let stoppedEarly = false;

  // Фільтруємо по created_at >= CUTOFF_UNIX (unix timestamp)
  while (page <= 50) {
    const url = `https://${AMO_DOMAIN}/api/v4/leads?page=${page}&limit=250&filter[created_at][from]=${CUTOFF_UNIX}&with=custom_fields_values`;
    const res = await fetch(url, { headers });

    if (res.status === 204 || res.status === 404) break;
    if (!res.ok) {
      const txt = await res.text();
      console.log(`✗ AMO page ${page}: ${res.status} ${txt.slice(0, 200)}`);
      break;
    }

    const data = await res.json();
    const rows = data?._embedded?.leads || [];
    if (!rows.length) break;

    allLeads.push(...rows);
    console.log(`  Page ${page}: ${rows.length} лідів (всього: ${allLeads.length})`);

    if (rows.length < 250) break;
    page++;
  }

  console.log(`\n📊 AMO — всього лідів >= 22 квітня: ${allLeads.length}`);

  // Фільтруємо ліди з PF полем
  const pfLeads = allLeads.filter(lead => {
    const fields = lead.custom_fields_values || [];
    return fields.some(f => f.field_id === PF_FIELD_LEAD_ID && f.values?.[0]?.value);
  });

  console.log(`📊 AMO — лідів з PF_LEAD_ID полем: ${pfLeads.length}`);

  // По датам
  const byDate = {};
  for (const l of pfLeads) {
    const d = new Date(l.created_at * 1000).toISOString().slice(0, 10);
    byDate[d] = (byDate[d] || 0) + 1;
  }
  if (Object.keys(byDate).length > 0) {
    console.log('\nПо датам (AMO з PF полем):');
    for (const [d, cnt] of Object.entries(byDate).sort()) {
      console.log(`  ${d}: ${cnt} лідів`);
    }
  }

  // Статуси PF-лідів в AMO
  const statusCounts = {};
  for (const l of pfLeads) {
    const status = String(l.status_id);
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  if (Object.keys(statusCounts).length > 0) {
    console.log('\nСтатуси PF-лідів в AMO:');
    for (const [s, cnt] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  status_id ${s}: ${cnt}`);
    }
  }

  // Перші 5 для прикладу
  if (pfLeads.length > 0) {
    console.log('\nПриклади (перші 5 PF-лідів в AMO):');
    pfLeads.slice(0, 5).forEach(l => {
      const pfIdField = (l.custom_fields_values || []).find(f => f.field_id === PF_FIELD_LEAD_ID);
      const pfId = pfIdField?.values?.[0]?.value;
      const createdAt = new Date(l.created_at * 1000).toISOString();
      console.log(`  AMO[${l.id}] created=${createdAt} pf_lead_id=${pfId} name="${l.name}"`);
    });
  }

  return { all: allLeads, pf: pfLeads };
}

// ─── DB sync state ─────────────────────────────────────────────────────────────

async function fetchDbSyncState() {
  console.log('\n═══ 3. DB — pf_amo_sync_state ═══');

  const connStr = getConnStr();
  if (!connStr) { console.log('No POSTGRES_URL — skipping'); return null; }

  const pool = new pg.Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false }, max: 1 });
  try {
    // Перевіряємо чи таблиця існує
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'pf_amo_sync_state'
      ) as exists
    `);
    if (!tableCheck.rows[0]?.exists) {
      console.log('Таблиця pf_amo_sync_state не існує');
      return null;
    }

    const res = await pool.query(`
      SELECT 
        COUNT(*) as total,
        MIN(synced_at) as first_sync,
        MAX(synced_at) as last_sync
      FROM pf_amo_sync_state
      WHERE synced_at >= $1
    `, [CUTOFF.toISOString()]);

    const row = res.rows[0];
    console.log(`\n📊 DB sync state >= 22 квітня:`);
    console.log(`  Всього записів: ${row.total}`);
    console.log(`  Перший sync: ${row.first_sync || 'n/a'}`);
    console.log(`  Останній sync: ${row.last_sync || 'n/a'}`);

    // По датам
    const byDate = await pool.query(`
      SELECT DATE(synced_at) as d, COUNT(*) as cnt
      FROM pf_amo_sync_state
      WHERE synced_at >= $1
      GROUP BY DATE(synced_at)
      ORDER BY d
    `, [CUTOFF.toISOString()]);

    if (byDate.rows.length > 0) {
      console.log('\nПо датам:');
      for (const r of byDate.rows) {
        console.log(`  ${r.d}: ${r.cnt} лідів`);
      }
    }

    return { total: Number(row.total), firstSync: row.first_sync, lastSync: row.last_sync };
  } finally {
    await pool.end();
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═════════════════════════════════════════════════');
  console.log('   АНАЛІЗ PF ЛІДІВ З 22 КВІТНЯ 2026 Р.');
  console.log(`   Дата запуску: ${new Date().toISOString()}`);
  console.log('═════════════════════════════════════════════════');

  // 1. PF API
  const pfLeads = await fetchPfLeadsSinceApr22();

  // 2. AMO tokens
  let amoResult = null;
  try {
    const tokens = await getAmoTokensFromDb();
    console.log('\n✓ AMO tokens loaded from DB');
    amoResult = await fetchAmoLeadsSinceApr22(tokens);
  } catch (e) {
    console.log(`\n✗ AMO error: ${e.message}`);
  }

  // 3. DB sync state
  const dbState = await fetchDbSyncState();

  // ─── SUMMARY ────────────────────────────────────────────────────
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║           ПІДСУМОК (з 22 квітня 2026)            ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║  PF API (всього лідів):       ${String(pfLeads?.length ?? 'ERROR').padEnd(18)} ║`);
  console.log(`║  PF API (listing leads):      ${String(pfLeads?.filter(l => (l.entityType||'').toLowerCase() !== 'project').length ?? 'ERROR').padEnd(18)} ║`);
  console.log(`║  PF API (project leads):      ${String(pfLeads?.filter(l => (l.entityType||'').toLowerCase() === 'project').length ?? 'ERROR').padEnd(18)} ║`);
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║  AMO (всі нові ліди):         ${String(amoResult?.all?.length ?? 'ERROR').padEnd(18)} ║`);
  console.log(`║  AMO (з PF_LEAD_ID полем):    ${String(amoResult?.pf?.length ?? 'ERROR').padEnd(18)} ║`);
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║  DB sync_state записів:       ${String(dbState?.total ?? 'ERROR').padEnd(18)} ║`);
  console.log('╚═══════════════════════════════════════════════════╝');

  if (pfLeads && amoResult?.pf !== undefined) {
    const diff = (pfLeads.length) - (amoResult.pf.length);
    if (diff > 0) {
      console.log(`\n⚠️  РІЗНИЦЯ: ${diff} лідів є у PF але НЕ потрапили в AMO`);
    } else if (diff < 0) {
      console.log(`\n⚠️  РІЗНИЦЯ: ${Math.abs(diff)} лідів є в AMO але не знайдено в PF`);
    } else {
      console.log(`\n✓ PF та AMO синхронізовані (однакова кількість)`);
    }
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
