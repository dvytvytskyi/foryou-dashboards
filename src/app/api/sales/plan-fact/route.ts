import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { readPlanDataFromSheets, PlanByBroker } from '@/lib/sheets/planReader';
import { classifyLeadSource, CLOSED_DEAL_STATUS_IDS } from '@/lib/crmRules.js';
import { amoFetchJson as sharedAmoFetchJson } from '@/lib/amo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type AmoLead = {
  id: number;
  name: string;
  price: number;
  created_at: number;
  status_id: number;
  pipeline_id: number;
  responsible_user_id: number;
  custom_fields_values?: Array<{
    field_id?: number;
    field_code?: string;
    values?: Array<{ value?: string }>;
  }>;
  _embedded?: {
    tags?: Array<{ name: string }>;
  };
};

type AmoTask = {
  id: number;
  responsible_user_id: number;
  entity_id: number;
  entity_type: string;
  is_completed: boolean;
  complete_till?: number;
};

type AmoUser = {
  id: number;
  name: string;
};

type SourceName =
  | 'Red'
  | 'Property Finder'
  | 'Klykov'
  | 'Oman'
  | 'Facebook'
  | 'Partners leads'
  | 'Own leads';

type RawLead = AmoLead & {
  source_name?: SourceName;
  broker_name?: string;
};

const CACHE_DIR = path.resolve(process.cwd(), 'data/cache/plan-fact');
const RAW_CACHE_FILE = path.join(CACHE_DIR, 'raw_leads.json');
const CACHE_TTL_MS = 30 * 60 * 1000;
const BQ_READ_CACHE_TTL_MS = 60 * 1000;
const BQ_PROJECT_ID = 'crypto-world-epta';
const BQ_DATASET = 'foryou_analytics';
const BQ_LEADS_TABLE = 'plan_fact_crm_leads';
const BQ_TASKS_TABLE = 'plan_fact_crm_tasks';

const bqCredentials = process.env.GOOGLE_AUTH_JSON ? JSON.parse(process.env.GOOGLE_AUTH_JSON) : undefined;
const bq = new BigQuery({
  projectId: BQ_PROJECT_ID,
  credentials: bqCredentials,
  keyFilename: !bqCredentials ? path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json') : undefined,
});

type RawData = {
  leads: RawLead[];
  tasks: AmoTask[];
  users: AmoUser[];
  createdAt: number;
};

type BqLeadRow = {
  lead_id: number | string;
  created_at: string | { value?: string };
  status_id: number | string;
  pipeline_id: number | string;
  responsible_user_id: number | string;
  broker_name: string;
  source_name: SourceName;
  price: number | string;
};

type BqTaskRow = {
  task_id: number | string;
  responsible_user_id: number | string;
  entity_id: number | string;
  entity_type: string;
  is_completed: boolean;
  complete_till: string | { value?: string } | null;
};

let _rawDataFetchPromise: Promise<RawData> | null = null;
let _bqReadCache: RawData | null = null;

const RE_PIPELINE_ID = 8696950;
const KLYKOV_PIPELINE_ID = 10776450;
const INCLUDED_PIPELINES = new Set([RE_PIPELINE_ID, KLYKOV_PIPELINE_ID]);

// Won in sales includes classic Sold plus SPA and POST SALES document stages.
const WON_STATUS_IDS = new Set(CLOSED_DEAL_STATUS_IDS);
const LOST_STATUS_ID = 143;

function isWonStatus(statusId: number) {
  return WON_STATUS_IDS.has(statusId);
}

const RE_QL_STATUSES = new Set([
  70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802,
]);
const KL_QL_STATUSES = new Set([
  84853934, 84853938, 84853942, 84853946, 84853950, 84853954, 84853958, 84853962, 84853966,
]);

const RE_SHOWING_STATUSES = new Set([70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802]);
const KL_SHOWING_STATUSES = new Set([84853942, 84853946, 84853950, 84853954, 84853958, 84853962, 84853966]);

const SOURCE_FIELD_ID = 703131; // "Источник"
const SOURCE_ORDER: SourceName[] = [
  'Red',
  'Property Finder',
  'Klykov',
  'Oman',
  'Facebook',
  'Partners leads',
  'Own leads',
];

function isQlStatus(lead: AmoLead) {
  if (lead.pipeline_id === RE_PIPELINE_ID) return RE_QL_STATUSES.has(lead.status_id);
  if (lead.pipeline_id === KLYKOV_PIPELINE_ID) return KL_QL_STATUSES.has(lead.status_id);
  return false;
}

function isShowingStatus(lead: AmoLead) {
  if (lead.pipeline_id === RE_PIPELINE_ID) return RE_SHOWING_STATUSES.has(lead.status_id);
  if (lead.pipeline_id === KLYKOV_PIPELINE_ID) return KL_SHOWING_STATUSES.has(lead.status_id);
  return false;
}

function classifySource(lead: AmoLead): SourceName {
  const preclassified = (lead as RawLead).source_name;
  if (preclassified && SOURCE_ORDER.includes(preclassified)) return preclassified;

  const tags = (lead._embedded?.tags || []).map((t) => t.name || '');
  const customFields = lead.custom_fields_values || [];
  const sourceValue = customFields.find((f) => f.field_id === SOURCE_FIELD_ID)?.values?.[0]?.value || '';
  const utmSource = customFields.find((f) => f.field_code === 'UTM_SOURCE')?.values?.[0]?.value || '';

  return classifyLeadSource({
    pipelineId: lead.pipeline_id,
    sourceValue,
    tags,
    utmSource,
    leadName: lead.name,
    defaultCategory: 'Own leads',
  }) as SourceName;
}

function toDateOnly(ts: number) {
  return new Date(ts * 1000);
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function inRange(d: Date, start: Date, end: Date) {
  return d >= start && d <= end;
}

function getPreviousRange(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const prevStart = new Date(prevEnd.getTime() - ms);
  return { prevStart, prevEnd };
}

function safePct(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function toNumber(value: unknown) {
  return Number(value || 0);
}

function timestampToUnix(value: unknown) {
  if (!value) return 0;
  const normalized = typeof value === 'object' && value !== null && 'value' in value
    ? (value as { value?: string }).value
    : String(value);
  const time = new Date(normalized || '').getTime();
  return Number.isNaN(time) ? 0 : Math.floor(time / 1000);
}

async function readRawDataFromBigQuery(): Promise<RawData | null> {
  try {
    if (_bqReadCache && Date.now() - _bqReadCache.createdAt <= BQ_READ_CACHE_TTL_MS) {
      return _bqReadCache;
    }

    const [[leadRows], [taskRows]] = await Promise.all([
      bq.query({
        query: `
          SELECT lead_id, created_at, status_id, pipeline_id, responsible_user_id, broker_name, source_name, price
          FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.${BQ_LEADS_TABLE}\`
        `,
        useLegacySql: false,
      }),
      bq.query({
        query: `
          SELECT task_id, responsible_user_id, entity_id, entity_type, is_completed, complete_till
          FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.${BQ_TASKS_TABLE}\`
          WHERE is_completed = FALSE
        `,
        useLegacySql: false,
      }),
    ]);

    const leads: RawLead[] = (leadRows as BqLeadRow[]).map((row) => ({
      id: toNumber(row.lead_id),
      name: '',
      price: toNumber(row.price),
      created_at: timestampToUnix(row.created_at),
      status_id: toNumber(row.status_id),
      pipeline_id: toNumber(row.pipeline_id),
      responsible_user_id: toNumber(row.responsible_user_id),
      source_name: row.source_name,
      broker_name: row.broker_name,
      custom_fields_values: [],
      _embedded: { tags: [] },
    }));

    if (!leads.length) return null;

    const tasks: AmoTask[] = (taskRows as BqTaskRow[]).map((row) => ({
      id: toNumber(row.task_id),
      responsible_user_id: toNumber(row.responsible_user_id),
      entity_id: toNumber(row.entity_id),
      entity_type: row.entity_type,
      is_completed: Boolean(row.is_completed),
      complete_till: row.complete_till ? timestampToUnix(row.complete_till) : undefined,
    }));

    _bqReadCache = {
      leads,
      tasks,
      users: [],
      createdAt: Date.now(),
    };

    return _bqReadCache;
  } catch (error) {
    console.warn('BigQuery read failed, fallback to CRM cache:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function readRawCache(): Promise<RawData | null> {
  try {
    const raw = await fs.readFile(RAW_CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as RawData;
    if (Date.now() - parsed.createdAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeRawCache(data: RawData) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(RAW_CACHE_FILE, JSON.stringify(data), 'utf8');
}

async function getOrFetchRawData(): Promise<RawData> {
  // Deduplicate concurrent requests — only one CRM fetch runs at a time
  if (_rawDataFetchPromise) return _rawDataFetchPromise;

  _rawDataFetchPromise = (async () => {
    try {
      const [usersResponse, reLeads, klykovLeads, openTasks] = await Promise.all([
        amoFetchJson<{ _embedded?: { users?: AmoUser[] } }>(`/api/v4/users?limit=250`),
        fetchAllLeadsByPipeline(RE_PIPELINE_ID),
        fetchAllLeadsByPipeline(KLYKOV_PIPELINE_ID),
        fetchAllOpenTasks(),
      ]);
      const result: RawData = {
        leads: [...reLeads, ...klykovLeads].filter((l) => INCLUDED_PIPELINES.has(l.pipeline_id)),
        tasks: openTasks,
        users: usersResponse?._embedded?.users || [],
        createdAt: Date.now(),
      };
      await writeRawCache(result);
      console.log(`✓ Raw CRM data cached: ${result.leads.length} leads, ${result.tasks.length} tasks`);
      return result;
    } finally {
      _rawDataFetchPromise = null;
    }
  })();

  return _rawDataFetchPromise;
}

async function amoFetchJson<T>(apiPath: string): Promise<T> {
  return sharedAmoFetchJson<T>(apiPath, {
    headers: { Accept: 'application/json' },
  });
}

async function fetchAllLeadsByPipeline(pipelineId: number): Promise<AmoLead[]> {
  const all: AmoLead[] = [];
  const limit = 250;
  let page = 1;
  const MAX_PAGES = 80;
  let lastFingerprint = '';

  while (true) {
    if (page > MAX_PAGES) break;

    const data = await amoFetchJson<{ _embedded?: { leads?: AmoLead[] } }>(
      `/api/v4/leads?filter[pipeline_id]=${pipelineId}&limit=${limit}&page=${page}&with=tags`,
    );

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

async function fetchAllOpenTasks(): Promise<AmoTask[]> {
  const all: AmoTask[] = [];
  const limit = 250;
  let page = 1;
  const MAX_PAGES = 120;
  let lastFingerprint = '';

  while (true) {
    if (page > MAX_PAGES) break;

    const data = await amoFetchJson<{ _embedded?: { tasks?: AmoTask[] } }>(
      `/api/v4/tasks?filter[is_completed]=0&limit=${limit}&page=${page}`,
    );

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

type MetricBucket = {
  received: number;
  prevReceived: number;
  ql: number;
  showings: number;
  deals: number;
  activeTotal: number;
  activeQl: number;
  activeShowings: number;
  missed: number;
  allTotal: number;
  allLost: number;
  allQl: number;
  allShowings: number;
  allDeals: number;
  revenueWon: number;
  overdue: number;
};

function createBucket(): MetricBucket {
  return {
    received: 0,
    prevReceived: 0,
    ql: 0,
    showings: 0,
    deals: 0,
    activeTotal: 0,
    activeQl: 0,
    activeShowings: 0,
    missed: 0,
    allTotal: 0,
    allLost: 0,
    allQl: 0,
    allShowings: 0,
    allDeals: 0,
    revenueWon: 0,
    overdue: 0,
  };
}

type BrokerAggregate = {
  id: number;
  name: string;
  metrics: MetricBucket;
  sources: Record<SourceName, MetricBucket>;
};

function newBrokerAggregate(id: number, name: string): BrokerAggregate {
  const sources = {} as Record<SourceName, MetricBucket>;
  for (const source of SOURCE_ORDER) {
    sources[source] = createBucket();
  }
  return {
    id,
    name,
    metrics: createBucket(),
    sources,
  };
}

function applyLeadToBucket(bucket: MetricBucket, lead: AmoLead, leadDate: Date, start: Date, end: Date, prevStart: Date, prevEnd: Date) {
  const won = isWonStatus(lead.status_id);
  const lost = lead.status_id === LOST_STATUS_ID;
  const active = !won && !lost;
  const qlNow = isQlStatus(lead);
  const showingNow = isShowingStatus(lead);

  // For historical columns we count current QL/showing stages + won.
  const qlEverLike = qlNow || won;
  const showingEverLike = showingNow || won;

  bucket.allTotal += 1;
  if (lost) bucket.allLost += 1;
  if (qlEverLike) bucket.allQl += 1;
  if (showingEverLike) bucket.allShowings += 1;
  if (won) {
    bucket.allDeals += 1;
    bucket.revenueWon += Number(lead.price || 0);
  }

  if (active) {
    bucket.activeTotal += 1;
    if (qlNow) bucket.activeQl += 1;
    if (showingNow) bucket.activeShowings += 1;
  }

  if (lost) {
    bucket.missed += 1;
  }

  if (inRange(leadDate, start, end)) {
    bucket.received += 1;
    if (qlEverLike) bucket.ql += 1;
    if (showingEverLike) bucket.showings += 1;
    if (won) bucket.deals += 1;
  }

  if (inRange(leadDate, prevStart, prevEnd)) {
    bucket.prevReceived += 1;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate') || '2000-01-01';
    const endDateParam = searchParams.get('endDate') || dateKey(new Date());

    const startDate = new Date(`${startDateParam}T00:00:00.000Z`);
    const endDate = new Date(`${endDateParam}T23:59:59.999Z`);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid date range' }, { status: 400 });
    }

    const { prevStart, prevEnd } = getPreviousRange(startDate, endDate);
    const month = endDate.getUTCMonth();
    const year = endDate.getUTCFullYear();

    const [bqRawData, planByBroker] = await Promise.all([
      readRawDataFromBigQuery(),
      readPlanDataFromSheets(month, year),
    ]);

    let rawData = bqRawData;
    let dataSource: 'bigquery' | 'crm-cache' = bqRawData ? 'bigquery' : 'crm-cache';
    if (!rawData) {
      const cachedRaw = await readRawCache();
      rawData = cachedRaw || (await getOrFetchRawData());
      dataSource = 'crm-cache';
    }

    const { leads, tasks: openTasks, users } = rawData;
    const userMap = new Map<number, string>(users.map((u) => [u.id, u.name]));
    const includedLeadIds = new Set<number>(leads.map((l) => l.id));

    const brokerMap = new Map<number, BrokerAggregate>();

    for (const lead of leads) {
      const brokerId = lead.responsible_user_id;
      const brokerName = (lead as RawLead).broker_name || userMap.get(brokerId) || `User #${brokerId}`;
      if (!brokerMap.has(brokerId)) {
        brokerMap.set(brokerId, newBrokerAggregate(brokerId, brokerName));
      }

      const broker = brokerMap.get(brokerId)!;
      const leadDate = toDateOnly(lead.created_at);
      const source = classifySource(lead);

      applyLeadToBucket(broker.metrics, lead, leadDate, startDate, endDate, prevStart, prevEnd);
      applyLeadToBucket(broker.sources[source], lead, leadDate, startDate, endDate, prevStart, prevEnd);
    }

    // Overdue tasks per broker for leads inside selected pipelines.
    const nowSec = Math.floor(Date.now() / 1000);
    for (const task of openTasks) {
      if (task.entity_type !== 'leads') continue;
      if (!task.complete_till || task.complete_till >= nowSec) continue;
      if (!includedLeadIds.has(task.entity_id)) continue;

      const broker = brokerMap.get(task.responsible_user_id);
      if (broker) {
        broker.metrics.overdue += 1;
      }
    }

    const brokers = Array.from(brokerMap.values())
      .map((broker) => {
        const sourceRows = SOURCE_ORDER
          .map((source) => ({
            source,
            metrics: broker.sources[source],
          }))
          .filter((row) => row.metrics.allTotal > 0)
          .map((row) => ({
            source: row.source,
            ...row.metrics,
          }));

        const brokerPlan = planByBroker[broker.name] || {
          lids: 0,
          ql: 0,
          revenue: 0,
          deals: 0,
        };

        const brokerFulfillmentLids = brokerPlan.lids > 0 ? Math.round((broker.metrics.received / brokerPlan.lids) * 100) : 0;
        const brokerFulfillmentQl = brokerPlan.ql > 0 ? Math.round((broker.metrics.ql / brokerPlan.ql) * 100) : 0;
        const brokerFulfillmentRevenue = brokerPlan.revenue > 0 ? Math.round((broker.metrics.revenueWon / brokerPlan.revenue) * 100) : 0;
        const brokerFulfillmentDeals = brokerPlan.deals > 0 ? Math.round((broker.metrics.deals / brokerPlan.deals) * 100) : 0;

        return {
          id: broker.id,
          name: broker.name,
          ...broker.metrics,
          plan: {
            lids: brokerPlan.lids,
            ql: brokerPlan.ql,
            revenue: brokerPlan.revenue,
            deals: brokerPlan.deals,
          },
          fulfillment: {
            lids: brokerFulfillmentLids,
            ql: brokerFulfillmentQl,
            revenue: brokerFulfillmentRevenue,
            deals: brokerFulfillmentDeals,
          },
          sourceRows,
          crQl: safePct(broker.metrics.ql, broker.metrics.received),
          crShowing: safePct(broker.metrics.showings, broker.metrics.received),
          allCrQl: safePct(broker.metrics.allQl, broker.metrics.allTotal),
          allCrShowing: safePct(broker.metrics.allShowings, broker.metrics.allTotal),
        };
      })
      .sort((a, b) => b.received - a.received || b.allTotal - a.allTotal);

    const totals = brokers.reduce(
      (acc, b) => {
        acc.received += b.received;
        acc.ql += b.ql;
        acc.deals += b.deals;
        acc.revenueWon += b.revenueWon;
        return acc;
      },
      { received: 0, ql: 0, deals: 0, revenueWon: 0 },
    );

    // Calculate total plan values from all brokers
    let totalPlanLids = 0;
    let totalPlanQl = 0;
    let totalPlanRevenue = 0;
    let totalPlanDeals = 0;
    
    for (const brokerPlan of Object.values(planByBroker)) {
      totalPlanLids += brokerPlan.lids;
      totalPlanQl += brokerPlan.ql;
      totalPlanRevenue += brokerPlan.revenue;
      totalPlanDeals += brokerPlan.deals;
    }

    // Calculate fulfillment percentages
    const fulfillmentLids = totalPlanLids > 0 ? Math.round((totals.received / totalPlanLids) * 100) : 0;
    const fulfillmentQl = totalPlanQl > 0 ? Math.round((totals.ql / totalPlanQl) * 100) : 0;
    const fulfillmentRevenue = totalPlanRevenue > 0 ? Math.round((totals.revenueWon / totalPlanRevenue) * 100) : 0;
    const fulfillmentDeals = totalPlanDeals > 0 ? Math.round((totals.deals / totalPlanDeals) * 100) : 0;

    const kpis = [
      { 
        label: 'ЛИДЫ (ПЛАН / ФАКТ)', 
        actual: totals.received, 
        plan: totalPlanLids, 
        fulfillment: fulfillmentLids,
        suffix: '' 
      },
      { 
        label: 'QL LEADS (ПЛАН / ФАКТ)', 
        actual: totals.ql, 
        plan: totalPlanQl, 
        fulfillment: fulfillmentQl,
        suffix: '' 
      },
      { 
        label: 'ВЫРУЧКА (ПЛАН / ФАКТ)', 
        actual: totals.revenueWon, 
        plan: totalPlanRevenue, 
        fulfillment: fulfillmentRevenue,
        suffix: ' AED' 
      },
      { 
        label: 'СДЕЛКИ (ПЛАН / ФАКТ)', 
        actual: totals.deals, 
        plan: totalPlanDeals, 
        fulfillment: fulfillmentDeals,
        suffix: '' 
      },
    ];

    const response = {
      success: true,
      meta: {
        dataSource,
        pipelines: [RE_PIPELINE_ID, KLYKOV_PIPELINE_ID],
        startDate: dateKey(startDate),
        endDate: dateKey(endDate),
        prevStartDate: dateKey(prevStart),
        prevEndDate: dateKey(prevEnd),
        leadsCount: leads.length,
        brokersCount: brokers.length,
      },
      kpis,
      brokers,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Plan/Fact API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
