import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { readPlanDataFromSheets, PlanByBroker } from '@/lib/sheets/planReader';
import { classifyLeadSource } from '@/lib/crmRules.js';
import { amoFetchJson as sharedAmoFetchJson } from '@/lib/amo';

const RAW_CACHE_FILE = path.resolve(process.cwd(), 'data/cache/plan-fact/raw_leads.json');

// Raw amoCRM lead as stored in the plan-fact CRM cache
type CacheLead = {
  id: number;
  name: string;
  price: number;
  created_at: number;
  status_id: number;
  pipeline_id: number;
  responsible_user_id: number;
  had_qual?: boolean;
  custom_fields_values?: Array<{
    field_id?: number;
    field_code?: string;
    values?: Array<{ value?: string }>;
  }>;
  _embedded?: {
    tags?: Array<{ name: string }>;
  };
  // Pre-classified fields (present when loaded from BQ-derived cache)
  source_name?: string;
  broker_name?: string;
};

type CacheTask = {
  id: number;
  responsible_user_id: number;
  entity_id: number;
  entity_type: string;
  is_completed: boolean;
  complete_till?: number;
};

type RawCacheFile = {
  leads: CacheLead[];
  tasks: CacheTask[];
  users: { id: number; name: string }[];
  createdAt: number;
};

const SOURCE_FIELD_ID_BROKERS = 703131; // "Источник"

function classifySourceFromRaw(lead: CacheLead, pipelineId: number, userDefinedSourceName?: string): SourceName {
  if (userDefinedSourceName) return userDefinedSourceName as SourceName;
  const customFields = lead.custom_fields_values || [];
  const sourceValue = customFields.find((f) => f.field_id === SOURCE_FIELD_ID_BROKERS)?.values?.[0]?.value || '';
  const utmSource = customFields.find((f) => f.field_code === 'UTM_SOURCE')?.values?.[0]?.value || '';
  const tags = (lead._embedded?.tags || []).map((t) => t.name || '');
  return classifyLeadSource({
    pipelineId,
    sourceValue,
    tags,
    utmSource,
    leadName: lead.name,
    defaultCategory: 'Own leads',
  }) as SourceName;
}

async function readCacheFile(): Promise<RawCacheFile | null> {
  try {
    const raw = await fs.readFile(RAW_CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as RawCacheFile;
    // Reject stale cache (older than 2 hours) so BQ is used instead
    const CACHE_TTL_MS = 2 * 60 * 60 * 1000;
    if (Date.now() - parsed.createdAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type SourceName = 'Red' | 'Primary Plus' | 'Property Finder' | 'Klykov' | 'Oman' | 'Facebook' | 'Partners leads' | 'Own leads';

type BqLeadRow = {
  lead_id: number | string;
  created_at: string | { value?: string };
  status_id: number | string;
  pipeline_id: number | string;
  responsible_user_id: number | string;
  broker_name: string;
  source_name: string;
  price: number | string;
};

type BqTaskRow = {
  task_id: number | string;
  responsible_user_id: number | string;
  entity_id: number | string;
  entity_type: string;
  is_completed: boolean | string;
  complete_till: string | { value?: string } | null;
};

type LeadRecord = {
  lead_id: number;
  broker_name: string;
  source_name: SourceName;
  status_id: number;
  pipeline_id: number;
  price: number;
  created_at_unix: number;
  is_ql: boolean;
  is_showing: boolean;
  is_won: boolean;
};

type TaskRecord = {
  task_id: number;
  broker_id: number;
  lead_id: number;
  is_completed: boolean;
  complete_till_unix: number;
  is_overdue: boolean;
};

type MetricsBySource = {
  [source in SourceName]?: {
    total_leads: number;
    ql_leads: number;
    showing_leads: number;
    won_leads: number;
    lost_leads: number;
    total_price: number;
    cr_lead_to_ql: number;
    cr_lead_to_showing: number;
    active_total_leads: number;
    active_ql_leads: number;
    active_showing_leads: number;
    active_reanimation_leads: number;
    overdue_tasks: number;
  };
};

type OverdueTask = {
  task_id: number;
  lead_id: number;
  task_text: string;
  complete_till_unix: number;
  days_overdue: number;
};

type PeriodMetrics = {
  total_leads: number;
  ql_leads: number;
  showing_leads: number;
  won_leads: number;
  revenue: number;
  lost_leads: number;
  by_source: MetricsBySource;
};

type PeriodComparison = {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  comparison_percent: number;
};

type BrokerMetrics = {
  broker_name: string;
  broker_id: number;
  period_data: PeriodComparison;
  by_source?: Record<string, any>;
  totals: {
    leads: number;
    ql_leads: number;
    showing_leads: number;
    won_leads: number;
    revenue: number;
    lost_leads: number;
  };
  plan: {
    lids: number;
    ql: number;
    revenue: number;
    deals: number;
  };
  overdue_tasks: OverdueTask[];
};

const BQ_PROJECT_ID = 'crypto-world-epta';
const BQ_DATASET = 'foryou_analytics';
const BQ_LEADS_TABLE = 'plan_fact_crm_leads';
const BQ_TASKS_TABLE = 'plan_fact_crm_tasks';

const RE_PIPELINE_ID = 8696950;
const KLYKOV_PIPELINE_ID = 10776450;
const PARTNERS_PIPELINE_ID = Number(process.env.AMO_PARTNERS_PIPELINE_ID || 8600274);
const INCLUDED_PIPELINES = new Set([RE_PIPELINE_ID, KLYKOV_PIPELINE_ID]);

const RE_QL_ACTUAL_STATUSES = new Set([
  70457466, 70457470, 70457474, 70457478, 70457482, 70457486,
]);
const KL_QL_ACTUAL_STATUSES = new Set([
  84853934, 84853938, 84853942, 84853946, 84853950, 84853954,
  // 84853958 POST SALES excluded — beyond Документы подписаны
]);

// Reanimation statuses
const RE_REANIMATION_STATUSES = new Set([82310010]);
const KL_REANIMATION_STATUSES = new Set([84853974]);

function isReanimationStatus(lead: { status_id: number; pipeline_id: number }): boolean {
  if (lead.pipeline_id === RE_PIPELINE_ID || lead.pipeline_id === PARTNERS_PIPELINE_ID) return RE_REANIMATION_STATUSES.has(lead.status_id);
  if (lead.pipeline_id === KLYKOV_PIPELINE_ID) return KL_REANIMATION_STATUSES.has(lead.status_id);
  return false;
}

// Allowed roles for broker dropdown: Брокер, РОП, Внутренний партнер
const ALLOWED_BROKER_ROLE_IDS = new Set([922586, 1193706, 1192690]);
let _userRoleCache: Map<number, number | null> | null = null;
let _userRoleCacheTime = 0;
const USER_ROLE_CACHE_TTL = 60 * 60 * 1000;

async function fetchUserRolesMap(): Promise<Map<number, number | null>> {
  if (_userRoleCache && Date.now() - _userRoleCacheTime < USER_ROLE_CACHE_TTL) {
    return _userRoleCache;
  }
  try {
    const data = await sharedAmoFetchJson<{ _embedded?: { users?: Array<{ id: number; rights?: { role_id?: number | null } }> } }>('/api/v4/users?limit=250', {
      headers: { Accept: 'application/json' },
    });
    const users = data?._embedded?.users || [];
    _userRoleCache = new Map(users.map(u => [u.id, u.rights?.role_id ?? null]));
    _userRoleCacheTime = Date.now();
    return _userRoleCache;
  } catch {
    return new Map();
  }
}

async function amoFetchJson<T>(apiPath: string): Promise<T> {
  return sharedAmoFetchJson<T>(apiPath, {
    headers: { Accept: 'application/json' },
  });
}

async function fetchAllLeadsByPipeline(pipelineId: number): Promise<CacheLead[]> {
  const all: CacheLead[] = [];
  const limit = 250;
  let page = 1;
  const MAX_PAGES = 80;
  let lastFingerprint = '';

  while (true) {
    if (page > MAX_PAGES) break;

    const data = await amoFetchJson<{ _embedded?: { leads?: CacheLead[] } }>(
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

async function fetchAllOpenTasksForBroker(brokerId: number): Promise<CacheTask[]> {
  const all: CacheTask[] = [];
  const limit = 250;
  let page = 1;
  const MAX_PAGES = 120;
  let lastFingerprint = '';

  while (true) {
    if (page > MAX_PAGES) break;

    const data = await amoFetchJson<{ _embedded?: { tasks?: CacheTask[] } }>(
      `/api/v4/tasks?filter[is_completed]=0&filter[responsible_user_id]=${brokerId}&limit=${limit}&page=${page}`,
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

function isQlActualStatus(lead: { status_id: number; pipeline_id: number }): boolean {
  if (lead.pipeline_id === RE_PIPELINE_ID)
    return RE_QL_ACTUAL_STATUSES.has(lead.status_id);
  if (lead.pipeline_id === KLYKOV_PIPELINE_ID) return KL_QL_ACTUAL_STATUSES.has(lead.status_id);
  return false;
}

// Won in sales includes classic Sold plus SPA and POST SALES document stages.
const WON_STATUS_IDS = new Set([142, 74717798, 74717802]);
const LOST_STATUS_ID = 143;

function isWonStatus(statusId: number) {
  return WON_STATUS_IDS.has(statusId);
}

const RE_QL_STATUSES = new Set([
  70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802, 70457490, 82310010, 142,
]);
const KL_QL_STATUSES = new Set([
  84853934, 84853938, 84853942, 84853946, 84853950, 84853954, 84853958, 84853962, 84853966,
]);

const RE_SHOWING_STATUSES = new Set([70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802]);
const KL_SHOWING_STATUSES = new Set([84853942, 84853946, 84853950, 84853954, 84853958, 84853962, 84853966]);

const SOURCE_ORDER: SourceName[] = [
  'Red',
  'Primary Plus',
  'Property Finder',
  'Klykov',
  'Oman',
  'Facebook',
  'Partners leads',
  'Own leads',
];

const bqCredentials = process.env.GOOGLE_AUTH_JSON ? JSON.parse(process.env.GOOGLE_AUTH_JSON) : undefined;
const bq = new BigQuery({
  projectId: BQ_PROJECT_ID,
  credentials: bqCredentials,
  keyFilename: !bqCredentials ? path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json') : undefined,
});

function toNumber(value: unknown): number {
  return Number(value || 0);
}

function timestampToUnix(value: unknown): number {
  if (!value) return 0;
  const normalized = typeof value === 'object' && value !== null && 'value' in value
    ? (value as { value?: string }).value
    : String(value);
  const time = new Date(normalized || '').getTime();
  return Number.isNaN(time) ? 0 : Math.floor(time / 1000);
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
  return Boolean(value);
}

function isQlStatus(lead: { status_id: number; pipeline_id: number }): boolean {
  if (lead.pipeline_id === RE_PIPELINE_ID || lead.pipeline_id === PARTNERS_PIPELINE_ID) return RE_QL_STATUSES.has(lead.status_id);
  if (lead.pipeline_id === KLYKOV_PIPELINE_ID) return KL_QL_STATUSES.has(lead.status_id);
  return false;
}

function isShowingStatus(lead: { status_id: number; pipeline_id: number }): boolean {
  if (lead.pipeline_id === RE_PIPELINE_ID || lead.pipeline_id === PARTNERS_PIPELINE_ID) return RE_SHOWING_STATUSES.has(lead.status_id);
  if (lead.pipeline_id === KLYKOV_PIPELINE_ID) return KL_SHOWING_STATUSES.has(lead.status_id);
  return false;
}

function isActiveLead(lead: LeadRecord): boolean {
  return !isWonStatus(lead.status_id) && lead.status_id !== LOST_STATUS_ID;
}

function toUnixRangeForMonth(month: number, year: number) {
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  return {
    startUnix: Math.floor(start.getTime() / 1000),
    endUnix: Math.floor(end.getTime() / 1000),
  };
}

function toUnixRangeForExplicitDates(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return {
    startUnix: Math.floor(start.getTime() / 1000),
    endUnix: Math.floor(end.getTime() / 1000),
  };
}

function getPreviousAnalogRange(startUnix: number, endUnix: number) {
  const duration = endUnix - startUnix + 1;
  const prevEndUnix = startUnix - 1;
  const prevStartUnix = prevEndUnix - duration + 1;
  return { prevStartUnix, prevEndUnix };
}

function buildPeriodMetrics(leads: LeadRecord[]): PeriodMetrics {
  const bySource: MetricsBySource = {};

  for (const source of SOURCE_ORDER) {
    const rows = leads.filter((l) => l.source_name === source);
    if (!rows.length) continue;

    const qlLeads = rows.filter((l) => l.is_ql).length;
    const showingLeads = rows.filter((l) => l.is_showing).length;

    bySource[source] = {
      total_leads: rows.length,
      ql_leads: qlLeads,
      showing_leads: showingLeads,
      won_leads: rows.filter((l) => l.is_won).length,
      lost_leads: rows.filter((l) => l.status_id === LOST_STATUS_ID).length,
      total_price: rows.reduce((sum, l) => sum + l.price, 0),
      cr_lead_to_ql: rows.length > 0 ? (qlLeads / rows.length) * 100 : 0,
      cr_lead_to_showing: rows.length > 0 ? (showingLeads / rows.length) * 100 : 0,
      active_total_leads: 0,
      active_ql_leads: 0,
      active_showing_leads: 0,
      overdue_tasks: 0,
    };
  }

  const totalLeads = leads.length;
  const totalQl = leads.filter((l) => l.is_ql).length;
  const totalShowing = leads.filter((l) => l.is_showing).length;

  return {
    total_leads: totalLeads,
    ql_leads: totalQl,
    showing_leads: totalShowing,
    won_leads: leads.filter((l) => l.is_won).length,
    revenue: leads.reduce((sum, l) => sum + l.price, 0),
    lost_leads: leads.filter((l) => l.status_id === LOST_STATUS_ID).length,
    by_source: bySource,
  };
}

async function loadLeadsAndTasks(brokerId: number): Promise<{ leads: LeadRecord[]; rawTasks: CacheTask[] }> {
  const [usersResponse, reLeads, klykovLeads, openTasks] = await Promise.all([
    amoFetchJson<{ _embedded?: { users?: Array<{ id: number; name: string }> } }>(`/api/v4/users?limit=250`),
    fetchAllLeadsByPipeline(RE_PIPELINE_ID),
    fetchAllLeadsByPipeline(KLYKOV_PIPELINE_ID),
    fetchAllOpenTasksForBroker(brokerId),
  ]);

  const userMap = new Map<number, string>((usersResponse?._embedded?.users || []).map((u) => [u.id, u.name]));
  const rawLeads = [...reLeads, ...klykovLeads].filter((l) => l.responsible_user_id === brokerId);

  const leads: LeadRecord[] = rawLeads.map((l) => {
    const statusId = l.status_id;
    const pipelineId = l.pipeline_id;
    const resolvedBrokerName = l.broker_name || userMap.get(l.responsible_user_id) || `User #${l.responsible_user_id}`;
    const sourceName = classifySourceFromRaw(l, pipelineId, l.source_name);
    return {
      lead_id: l.id,
      broker_name: resolvedBrokerName,
      source_name: sourceName,
      status_id: statusId,
      pipeline_id: pipelineId,
      price: l.price || 0,
      created_at_unix: l.created_at,
      is_ql: isQlStatus({ status_id: statusId, pipeline_id: pipelineId }),
      is_showing: isShowingStatus({ status_id: statusId, pipeline_id: pipelineId }),
      is_won: isWonStatus(statusId),
    };
  });

  const rawTasks = openTasks.filter(
    (t) => t.responsible_user_id === brokerId && t.entity_type === 'leads' && !t.is_completed,
  );

  return { leads, rawTasks };
}

async function getBrokerMetrics(
  brokerId: number,
  brokerName: string,
  month: number,
  year: number,
  startDate?: string,
  endDate?: string,
): Promise<BrokerMetrics> {
  const { leads, rawTasks } = await loadLeadsAndTasks(brokerId);

  // Match plan-fact overdue rule exactly:
  // count overdue tasks assigned to broker for leads from included pipelines,
  // where lead is in QL Actual stage (global lead set, not only broker-owned leads).
  const cacheForOverdue = await readCacheFile();
  const includedLeadIdsGlobal = new Set<number>();
  const qlActualLeadIdsGlobal = new Set<number>();

  if (cacheForOverdue) {
    for (const l of cacheForOverdue.leads) {
      if (!INCLUDED_PIPELINES.has(l.pipeline_id)) continue;
      includedLeadIdsGlobal.add(l.id);
      if (isQlActualStatus({ status_id: l.status_id, pipeline_id: l.pipeline_id })) {
        qlActualLeadIdsGlobal.add(l.id);
      }
    }
  }

  // Fallback when cache is unavailable
  if (includedLeadIdsGlobal.size === 0) {
    for (const l of leads) {
      includedLeadIdsGlobal.add(l.lead_id);
      if (isQlActualStatus({ status_id: l.status_id, pipeline_id: l.pipeline_id })) {
        qlActualLeadIdsGlobal.add(l.lead_id);
      }
    }
  }

  // Build overdue tasks (only for QL Actual leads)
  const now = Math.floor(Date.now() / 1000);
  const overdueTasks: OverdueTask[] = rawTasks
    .filter((t) => t.entity_type === 'leads'
      && t.complete_till
      && t.complete_till < now
      && includedLeadIdsGlobal.has(t.entity_id)
      && qlActualLeadIdsGlobal.has(t.entity_id))
    .map((t) => ({
      task_id: t.id,
      lead_id: t.entity_id,
      task_text: '',
      complete_till_unix: t.complete_till!,
      days_overdue: Math.max(0, Math.ceil((now - t.complete_till!) / (24 * 3600))),
    }))
    .sort((a, b) => a.complete_till_unix - b.complete_till_unix)
    .slice(0, 50);

  const leadSourceById = new Map<number, SourceName>();
  for (const lead of leads) {
    leadSourceById.set(lead.lead_id, lead.source_name);
  }

  const overdueTasksBySource = new Map<SourceName, number>();
  for (const task of overdueTasks) {
    const source = leadSourceById.get(task.lead_id);
    if (!source) continue;
    overdueTasksBySource.set(source, (overdueTasksBySource.get(source) || 0) + 1);
  }

  // Aggregate by source
  const bySourceMap: MetricsBySource = {};

  for (const source of SOURCE_ORDER) {
    const leadsInSource = leads.filter((l) => l.source_name === source);
    if (!leadsInSource.length) continue;

    const activeLeadsInSource = leadsInSource.filter((l) => isActiveLead(l));
    const activeQl = activeLeadsInSource.filter((l) => l.is_ql).length;
    const activeShowing = activeLeadsInSource.filter((l) => l.is_showing).length;

    bySourceMap[source] = {
      total_leads: leadsInSource.length,
      ql_leads: leadsInSource.filter((l) => l.is_ql).length,
      showing_leads: leadsInSource.filter((l) => l.is_showing).length,
      won_leads: leadsInSource.filter((l) => l.is_won).length,
      lost_leads: leadsInSource.filter((l) => l.status_id === LOST_STATUS_ID).length,
      total_price: leadsInSource.reduce((sum, l) => sum + l.price, 0),
      cr_lead_to_ql: leadsInSource.length > 0 ? (leadsInSource.filter((l) => l.is_ql).length / leadsInSource.length) * 100 : 0,
      cr_lead_to_showing: leadsInSource.length > 0 ? (leadsInSource.filter((l) => l.is_showing).length / leadsInSource.length) * 100 : 0,
      active_total_leads: activeLeadsInSource.length,
      active_ql_leads: activeQl,
      active_showing_leads: activeShowing,
      active_reanimation_leads: activeLeadsInSource.filter((l) => isReanimationStatus(l)).length,
      overdue_tasks: overdueTasksBySource.get(source) || 0,
    };
  }

  const explicitRange = startDate && endDate ? toUnixRangeForExplicitDates(startDate, endDate) : null;
  const currentRange = explicitRange || toUnixRangeForMonth(month, year);
  const { prevStartUnix: previousStartUnix, prevEndUnix: previousEndUnix } = getPreviousAnalogRange(
    currentRange.startUnix,
    currentRange.endUnix,
  );

  const currentPeriodLeads = leads.filter(
    (l) => l.created_at_unix >= currentRange.startUnix && l.created_at_unix <= currentRange.endUnix,
  );
  const previousPeriodLeads = leads.filter((l) => l.created_at_unix >= previousStartUnix && l.created_at_unix <= previousEndUnix);

  const currentPeriod = buildPeriodMetrics(currentPeriodLeads);
  const previousPeriod = buildPeriodMetrics(previousPeriodLeads);
  const comparisonPercent = previousPeriod.total_leads > 0
    ? ((currentPeriod.total_leads - previousPeriod.total_leads) / previousPeriod.total_leads) * 100
    : 0;

  // Period-based totals for KPI plan/fact comparison
  const totalLeads = currentPeriodLeads.length;
  const totalQl = currentPeriodLeads.filter((l) => l.is_ql).length;
  const totalShowing = currentPeriodLeads.filter((l) => l.is_showing).length;
  const totalWon = currentPeriodLeads.filter((l) => l.is_won).length;
  const totalLost = currentPeriodLeads.filter((l) => l.status_id === LOST_STATUS_ID).length;
  const totalRevenue = currentPeriodLeads.filter((l) => l.is_won).reduce((sum, l) => sum + l.price, 0);

  // Read plan data from Sheets
  let planData: PlanByBroker = {};
  try {
    planData = await readPlanDataFromSheets(month, year);
  } catch (err) {
    console.warn('Failed to read plan data from Sheets:', err instanceof Error ? err.message : String(err));
  }

  const brokerPlan = planData[brokerName] || { lids: 0, ql: 0, revenue: 0, deals: 0 };

  return {
    broker_name: brokerName,
    broker_id: brokerId,
    period_data: {
      current: currentPeriod,
      previous: previousPeriod,
      comparison_percent: comparisonPercent,
    },
    by_source: bySourceMap,
    totals: {
      leads: totalLeads,
      ql_leads: totalQl,
      showing_leads: totalShowing,
      won_leads: totalWon,
      revenue: totalRevenue,
      lost_leads: totalLost,
    },
    plan: {
      lids: brokerPlan.lids,
      ql: brokerPlan.ql,
      revenue: brokerPlan.revenue,
      deals: brokerPlan.deals,
    },
    overdue_tasks: overdueTasks,
  };
}

async function getAllBrokers(): Promise<Array<{ id: number; name: string }>> {
  const [roleMap, usersResponse, reLeads, klykovLeads] = await Promise.all([
    fetchUserRolesMap(),
    amoFetchJson<{ _embedded?: { users?: Array<{ id: number; name: string }> } }>(`/api/v4/users?limit=250`),
    fetchAllLeadsByPipeline(RE_PIPELINE_ID),
    fetchAllLeadsByPipeline(KLYKOV_PIPELINE_ID),
  ]);

  const userMap = new Map<number, string>((usersResponse?._embedded?.users || []).map((u) => [u.id, u.name]));
  const brokerIds = new Set<number>([...reLeads, ...klykovLeads].map((l) => l.responsible_user_id));

  function isAllowedBroker(id: number): boolean {
    if (roleMap.size === 0) return true;
    const role = roleMap.get(id);
    return role !== undefined && ALLOWED_BROKER_ROLE_IDS.has(role as number);
  }

  return Array.from(brokerIds)
    .filter((id) => userMap.has(id) && isAllowedBroker(id))
    .map((id) => ({ id, name: userMap.get(id)! }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const brokerId = url.searchParams.get('brokerId');
    const brokerName = url.searchParams.get('brokerName');
    const monthStr = url.searchParams.get('month') || String(new Date().getMonth());
    const yearStr = url.searchParams.get('year') || String(new Date().getFullYear());
    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;

    const month = Math.max(0, Math.min(11, parseInt(monthStr, 10)));
    const year = parseInt(yearStr, 10);

    // If no brokerId provided, return list of all brokers
    if (!brokerId || !brokerName) {
      const brokers = await getAllBrokers();
      return NextResponse.json({ brokers }, { status: 200 });
    }

    const brokerIdNum = parseInt(brokerId, 10);
    const metrics = await getBrokerMetrics(brokerIdNum, brokerName, month, year, startDate, endDate);

    return NextResponse.json(metrics, { status: 200 });
  } catch (error) {
    console.error('Brokers API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
