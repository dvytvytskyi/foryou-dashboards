import { BigQuery } from '@google-cloud/bigquery';
import fs from 'fs/promises';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const LEADS_TABLE_ID = 'plan_fact_crm_leads';
const TASKS_TABLE_ID = 'plan_fact_crm_tasks';
const SERVICE_ACCOUNT_FILE = path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');

const AMO_DOMAIN = process.env.AMO_DOMAIN || 'reforyou.amocrm.ru';
const AMO_CLIENT_ID = process.env.AMO_CLIENT_ID || '';
const AMO_CLIENT_SECRET = process.env.AMO_CLIENT_SECRET || '';
const AMO_REDIRECT_URI = process.env.AMO_REDIRECT_URI || '';

const TOKENS_FILE = path.resolve(process.cwd(), 'secrets/amo_tokens.json');
const RAW_CACHE_FILE = path.resolve(process.cwd(), 'data/cache/plan-fact/raw_leads.json');
const CACHE_TTL_MS = 30 * 60 * 1000;

const RE_PIPELINE_ID = 8696950;
const KLYKOV_PIPELINE_ID = 10776450;
const INCLUDED_PIPELINES = new Set([RE_PIPELINE_ID, KLYKOV_PIPELINE_ID]);
const SOURCE_FIELD_ID = 703131;

const bq = new BigQuery({
  projectId: PROJECT_ID,
  keyFilename: SERVICE_ACCOUNT_FILE,
});

function normalizeText(v) {
  return String(v || '').trim().toLowerCase();
}

function classifySource(lead) {
  const tags = (lead._embedded?.tags || []).map((t) => t.name || '');
  const tagsNorm = tags.map(normalizeText);
  const customFields = lead.custom_fields_values || [];
  const sourceValue = customFields.find((f) => f.field_id === SOURCE_FIELD_ID)?.values?.[0]?.value || '';
  const utmSource = customFields.find((f) => f.field_code === 'UTM_SOURCE')?.values?.[0]?.value || '';
  const bag = [sourceValue, utmSource, lead.name, ...tags].map(normalizeText).join(' | ');

  if (lead.pipeline_id === KLYKOV_PIPELINE_ID || bag.includes('klykov')) return 'Klykov';
  if (tagsNorm.some((t) => ['red_ru', 'red_eng', 'red_lux', 'red_arm'].includes(t)) || bag.includes('red')) return 'Red';
  if (
    bag.includes('property finder') ||
    bag.includes('pf off-plan') ||
    bag.includes('pf offplan') ||
    bag.includes('pf ') ||
    bag.includes('bayut') ||
    bag.includes('prian')
  ) {
    return 'Property Finder';
  }
  if (bag.includes('oman')) return 'Oman';
  if (bag.includes('facebook') || bag.includes(' fb') || bag.startsWith('fb ') || bag.includes('meta')) return 'Facebook';
  if (bag.includes('partner') || bag.includes('партнер')) return 'Partners leads';
  return 'Own leads';
}

async function readTokensFile() {
  const raw = await fs.readFile(TOKENS_FILE, 'utf8');
  return JSON.parse(raw);
}

async function writeTokensFile(tokens) {
  await fs.writeFile(
    TOKENS_FILE,
    JSON.stringify({ ...tokens, server_time: Math.floor(Date.now() / 1000) }, null, 2),
    'utf8',
  );
}

async function refreshTokens(tokens) {
  const res = await fetch(`https://${AMO_DOMAIN}/oauth2/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: AMO_CLIENT_ID,
      client_secret: AMO_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      redirect_uri: AMO_REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to refresh AmoCRM token: ${await res.text()}`);
  }

  const nextTokens = await res.json();
  await writeTokensFile(nextTokens);
  return nextTokens;
}

async function amoFetchJson(apiPath, tokens) {
  const url = `https://${AMO_DOMAIN}${apiPath}`;

  const doRequest = async (accessToken) => {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    return res;
  };

  let res = await doRequest(tokens.access_token);
  if (res.status === 401) {
    const refreshed = await refreshTokens(tokens);
    res = await doRequest(refreshed.access_token);
  }

  if (res.status === 204) return {};
  if (!res.ok) throw new Error(`AmoCRM request failed (${apiPath}): ${await res.text()}`);
  return res.json();
}

async function fetchAllLeadsByPipeline(pipelineId, tokens) {
  const all = [];
  const limit = 250;
  let page = 1;
  let lastFingerprint = '';

  while (page <= 80) {
    const data = await amoFetchJson(`/api/v4/leads?filter[pipeline_id]=${pipelineId}&limit=${limit}&page=${page}&with=tags`, tokens);
    const leads = data?._embedded?.leads || [];
    if (!leads.length) break;

    const fingerprint = `${leads[0]?.id || 0}-${leads[leads.length - 1]?.id || 0}-${leads.length}`;
    if (fingerprint === lastFingerprint) break;
    lastFingerprint = fingerprint;

    all.push(...leads);
    if (leads.length < limit) break;
    page += 1;
  }

  return all;
}

async function fetchAllOpenTasks(tokens) {
  const all = [];
  const limit = 250;
  let page = 1;
  let lastFingerprint = '';

  while (page <= 120) {
    const data = await amoFetchJson(`/api/v4/tasks?filter[is_completed]=0&limit=${limit}&page=${page}`, tokens);
    const tasks = data?._embedded?.tasks || [];
    if (!tasks.length) break;

    const fingerprint = `${tasks[0]?.id || 0}-${tasks[tasks.length - 1]?.id || 0}-${tasks.length}`;
    if (fingerprint === lastFingerprint) break;
    lastFingerprint = fingerprint;

    all.push(...tasks);
    if (tasks.length < limit) break;
    page += 1;
  }

  return all;
}

async function readRawCache() {
  try {
    const raw = await fs.readFile(RAW_CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.createdAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function fetchRawData() {
  const cached = await readRawCache();
  if (cached) {
    console.log(`Using local raw cache: ${cached.leads.length} leads`);
    return cached;
  }

  const tokens = await readTokensFile();
  const [usersResponse, reLeads, klykovLeads, openTasks] = await Promise.all([
    amoFetchJson('/api/v4/users?limit=250', tokens),
    fetchAllLeadsByPipeline(RE_PIPELINE_ID, tokens),
    fetchAllLeadsByPipeline(KLYKOV_PIPELINE_ID, tokens),
    fetchAllOpenTasks(tokens),
  ]);

  return {
    leads: [...reLeads, ...klykovLeads].filter((lead) => INCLUDED_PIPELINES.has(lead.pipeline_id)),
    tasks: openTasks,
    users: usersResponse?._embedded?.users || [],
  };
}

async function ensureTables() {
  await bq.query(`
    CREATE TABLE IF NOT EXISTS \`${PROJECT_ID}.${DATASET_ID}.${LEADS_TABLE_ID}\` (
      lead_id INT64,
      created_at TIMESTAMP,
      status_id INT64,
      pipeline_id INT64,
      responsible_user_id INT64,
      broker_name STRING,
      source_name STRING,
      price FLOAT64,
      synced_at TIMESTAMP
    )
  `);

  await bq.query(`
    CREATE TABLE IF NOT EXISTS \`${PROJECT_ID}.${DATASET_ID}.${TASKS_TABLE_ID}\` (
      task_id INT64,
      responsible_user_id INT64,
      entity_id INT64,
      entity_type STRING,
      is_completed BOOL,
      complete_till TIMESTAMP,
      synced_at TIMESTAMP
    )
  `);
}

async function replaceTable(tableName, rows) {
  await bq.query(`TRUNCATE TABLE \`${PROJECT_ID}.${DATASET_ID}.${tableName}\``);

  if (!rows.length) return;

  const table = bq.dataset(DATASET_ID).table(tableName);
  const chunkSize = 500;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await table.insert(chunk);
    process.stdout.write(`Inserted ${Math.min(index + chunk.length, rows.length)}/${rows.length} into ${tableName}\r`);
  }
  process.stdout.write('\n');
}

async function main() {
  console.log('--- Syncing plan-fact source data to BigQuery ---');
  await ensureTables();

  const rawData = await fetchRawData();
  const userMap = new Map((rawData.users || []).map((user) => [user.id, user.name]));
  const syncedAt = new Date().toISOString();

  const leadRows = rawData.leads.map((lead) => ({
    lead_id: Number(lead.id),
    created_at: new Date(Number(lead.created_at) * 1000).toISOString(),
    status_id: Number(lead.status_id),
    pipeline_id: Number(lead.pipeline_id),
    responsible_user_id: Number(lead.responsible_user_id),
    broker_name: userMap.get(lead.responsible_user_id) || `User #${lead.responsible_user_id}`,
    source_name: classifySource(lead),
    price: Number(lead.price || 0),
    synced_at: syncedAt,
  }));

  const taskRows = rawData.tasks.map((task) => ({
    task_id: Number(task.id),
    responsible_user_id: Number(task.responsible_user_id),
    entity_id: Number(task.entity_id),
    entity_type: task.entity_type,
    is_completed: Boolean(task.is_completed),
    complete_till: task.complete_till ? new Date(Number(task.complete_till) * 1000).toISOString() : null,
    synced_at: syncedAt,
  }));

  console.log(`Prepared ${leadRows.length} leads and ${taskRows.length} tasks`);
  await replaceTable(LEADS_TABLE_ID, leadRows);
  await replaceTable(TASKS_TABLE_ID, taskRows);
  console.log('SUCCESS: plan-fact source data synced to BigQuery');
}

main().catch((error) => {
  console.error('FAILED: sync_plan_fact_bq', error);
  process.exit(1);
});