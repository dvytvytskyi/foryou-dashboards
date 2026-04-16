import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { readPlanDataFromSheets, PlanByBroker } from '@/lib/sheets/planReader';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type SourceName = 'Red' | 'Property Finder' | 'Klykov' | 'Oman' | 'Facebook' | 'Partners leads' | 'Own leads';

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

// Won in sales includes classic Sold plus SPA and POST SALES document stages.
const WON_STATUS_IDS = new Set([142, 74717798, 74717802]);
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

const SOURCE_ORDER: SourceName[] = [
  'Red',
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
  if (lead.pipeline_id === RE_PIPELINE_ID) return RE_QL_STATUSES.has(lead.status_id);
  if (lead.pipeline_id === KLYKOV_PIPELINE_ID) return KL_QL_STATUSES.has(lead.status_id);
  return false;
}

function isShowingStatus(lead: { status_id: number; pipeline_id: number }): boolean {
  if (lead.pipeline_id === RE_PIPELINE_ID) return RE_SHOWING_STATUSES.has(lead.status_id);
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

async function getBrokerMetrics(
  brokerId: number,
  brokerName: string,
  month: number,
  year: number,
  startDate?: string,
  endDate?: string,
): Promise<BrokerMetrics> {
  // Fetch leads from BigQuery
  const [leadRows] = await bq.query({
    query: `
      SELECT 
        lead_id, created_at, status_id, pipeline_id, responsible_user_id, 
        broker_name, source_name, price
      FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.${BQ_LEADS_TABLE}\`
      WHERE responsible_user_id = @brokerId
    `,
    params: { brokerId },
    useLegacySql: false,
  });

  // Fetch overdue tasks with more details
  const [taskDetailsRows] = await bq.query({
    query: `
      SELECT 
        t.task_id,
        t.entity_id as lead_id,
        t.complete_till
      FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.${BQ_TASKS_TABLE}\` t
      WHERE t.responsible_user_id = @brokerId 
        AND t.is_completed = FALSE 
        AND CAST(t.complete_till AS TIMESTAMP) < CURRENT_TIMESTAMP()
      ORDER BY t.complete_till ASC
      LIMIT 100
    `,
    params: { brokerId },
    useLegacySql: false,
  });

  const leads: LeadRecord[] = (leadRows as any[]).map((row) => {
    const statusId = toNumber(row.status_id);
    const pipelineId = toNumber(row.pipeline_id);
    return {
      lead_id: toNumber(row.lead_id),
      broker_name: String(row.broker_name),
      source_name: (String(row.source_name) as SourceName) || 'Own leads',
      status_id: statusId,
      pipeline_id: pipelineId,
      price: toNumber(row.price),
      created_at_unix: timestampToUnix(row.created_at),
      is_ql: isQlStatus({ status_id: statusId, pipeline_id: pipelineId }),
      is_showing: isShowingStatus({ status_id: statusId, pipeline_id: pipelineId }),
      is_won: isWonStatus(statusId),
    };
  });

  // Process overdue tasks
  const now = Math.floor(Date.now() / 1000);
  const overdueTasks: OverdueTask[] = (taskDetailsRows as any[])
    .map((row) => {
      const completeTillUnix = timestampToUnix(row.complete_till);
      const daysOverdue = Math.ceil((now - completeTillUnix) / (24 * 3600));
      return {
        task_id: toNumber(row.task_id),
        lead_id: toNumber(row.lead_id),
        task_text: '',
        complete_till_unix: completeTillUnix,
        days_overdue: Math.max(0, daysOverdue),
      };
    })
    .slice(0, 20);

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

  const totalLeads = leads.length;
  const totalQl = leads.filter((l) => l.is_ql).length;
  const totalShowing = leads.filter((l) => l.is_showing).length;
  const totalWon = leads.filter((l) => l.is_won).length;
  const totalLost = leads.filter((l) => l.status_id === LOST_STATUS_ID).length;
  const totalRevenue = leads.reduce((sum, l) => sum + l.price, 0);

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
  try {
    // Get unique brokers from BigQuery leads table
    const [rows] = await bq.query({
      query: `
        SELECT DISTINCT responsible_user_id, broker_name
        FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.${BQ_LEADS_TABLE}\`
        ORDER BY broker_name ASC
      `,
      useLegacySql: false,
    });

    if (!Array.isArray(rows)) {
      console.warn('BigQuery rows is not array:', typeof rows);
      return [];
    }

    return rows.map((row: any) => ({
      id: toNumber(row.responsible_user_id),
      name: String(row.broker_name),
    }));
  } catch (error) {
    console.warn('Failed to fetch brokers from BigQuery:', error instanceof Error ? error.message : String(error));
    return [];
  }
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
