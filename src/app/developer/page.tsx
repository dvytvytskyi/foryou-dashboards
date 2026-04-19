'use client';

import { useMemo, useState } from 'react';
import DashboardPage from '@/components/DashboardPage';
import styles from './developer.module.css';

type NodeType = 'page' | 'api' | 'source' | 'job' | 'workflow' | 'external';
type NodeStatus = 'ok' | 'warning' | 'risk';
type FreshnessMode = 'realtime' | 'scheduled' | 'manual' | 'unknown';
type EdgeType = 'calls' | 'reads_from' | 'writes_to' | 'scheduled_by' | 'uses';

type SystemNode = {
  id: string;
  type: NodeType;
  title: string;
  owner: string;
  freshnessMode: FreshnessMode;
  refreshFrequency: string;
  criticality: 'high' | 'medium' | 'low';
  status: NodeStatus;
  notes: string;
  fileRef: string;
};

type SystemEdge = {
  from: string;
  to: string;
  type: EdgeType;
};

const NODES: SystemNode[] = [
  { id: 'wf_data_sync', type: 'workflow', title: 'Data Sync Workflow', owner: 'Infra', freshnessMode: 'scheduled', refreshFrequency: 'hourly', criticality: 'high', status: 'ok', notes: 'Hourly sync for RED/Klykov/Unified leads', fileRef: '.github/workflows/data-sync.yml' },
  { id: 'wf_deploy', type: 'workflow', title: 'Deploy Workflow', owner: 'Infra', freshnessMode: 'manual', refreshFrequency: 'on push to main', criticality: 'high', status: 'ok', notes: 'Deploys current code and local data files', fileRef: '.github/workflows/deploy.yml' },

  { id: 'job_sync_red', type: 'job', title: 'sync_red_to_bq', owner: 'Marketing', freshnessMode: 'scheduled', refreshFrequency: 'hourly', criticality: 'high', status: 'ok', notes: 'Builds RED rows and writes to drilldown table', fileRef: 'scripts/sync/sync_red_to_bq.mjs' },
  { id: 'job_sync_klykov', type: 'job', title: 'sync_klykov_to_bq', owner: 'Marketing', freshnessMode: 'scheduled', refreshFrequency: 'hourly', criticality: 'high', status: 'ok', notes: 'Builds Klykov rows and writes to drilldown table', fileRef: 'scripts/sync/sync_klykov_to_bq.mjs' },
  { id: 'job_sync_unified', type: 'job', title: 'sync_unified_leads', owner: 'Marketing', freshnessMode: 'scheduled', refreshFrequency: 'hourly', criticality: 'high', status: 'ok', notes: 'Writes unified leads snapshot via truncate+load', fileRef: 'scripts/sync/sync_unified_leads.mjs' },
  { id: 'job_pf_listings', type: 'job', title: 'pf_export_full_json (manual)', owner: 'PF', freshnessMode: 'manual', refreshFrequency: 'manual', criticality: 'high', status: 'warning', notes: 'Generates data/exports/pf_full_export_latest.json', fileRef: 'scripts/pf_export_full_json.mjs' },
  { id: 'job_pf_projects', type: 'job', title: 'sync_pf_final_fix (manual)', owner: 'PF', freshnessMode: 'manual', refreshFrequency: 'manual', criticality: 'high', status: 'warning', notes: 'Syncs PF leads to BigQuery raw', fileRef: 'scripts/kpi/sync_pf_final_fix.mjs' },
  { id: 'job_sync_plan_fact', type: 'job', title: 'sync_plan_fact_bq', owner: 'Sales', freshnessMode: 'unknown', refreshFrequency: 'unknown', criticality: 'high', status: 'risk', notes: 'Script exists, scheduler not confirmed', fileRef: 'scripts/sync/sync_plan_fact_bq.mjs' },
  { id: 'job_sync_brokers', type: 'job', title: 'sync_brokers_bq', owner: 'Sales', freshnessMode: 'unknown', refreshFrequency: 'unknown', criticality: 'medium', status: 'risk', notes: 'Script exists, scheduler not confirmed', fileRef: 'scripts/sync/sync_brokers_bq.mjs' },

  { id: 'page_marketing', type: 'page', title: '/marketing', owner: 'Marketing', freshnessMode: 'scheduled', refreshFrequency: 'hourly', criticality: 'high', status: 'ok', notes: 'Main channel drilldown dashboard', fileRef: 'src/app/marketing/page.tsx' },
  { id: 'page_red', type: 'page', title: '/red', owner: 'Marketing', freshnessMode: 'scheduled', refreshFrequency: 'hourly + unknown', criticality: 'high', status: 'warning', notes: 'Uses drilldown + geo + scoreboard', fileRef: 'src/app/red/page.tsx' },
  { id: 'page_facebook', type: 'page', title: '/facebook', owner: 'Marketing', freshnessMode: 'unknown', refreshFrequency: 'unknown', criticality: 'high', status: 'risk', notes: 'Depends on amo_channel_leads_raw freshness', fileRef: 'src/app/facebook/page.tsx' },
  { id: 'page_pf', type: 'page', title: '/property-finder', owner: 'PF', freshnessMode: 'manual', refreshFrequency: 'manual + deploy', criticality: 'high', status: 'warning', notes: 'Reads PF JSON snapshots + BQ stats', fileRef: 'src/app/property-finder/page.tsx' },
  { id: 'page_sales', type: 'page', title: '/sales', owner: 'Sales', freshnessMode: 'manual', refreshFrequency: 'depends on xlsx update', criticality: 'high', status: 'risk', notes: 'Reads local Excel files at runtime', fileRef: 'src/app/sales/page.tsx' },
  { id: 'page_sales_dir', type: 'page', title: '/sales/directions', owner: 'Sales', freshnessMode: 'manual', refreshFrequency: 'depends on xlsx update', criticality: 'high', status: 'risk', notes: 'Reads local Excel files at runtime', fileRef: 'src/app/sales/directions/page.tsx' },
  { id: 'page_sales_pf', type: 'page', title: '/sales/plan-fact', owner: 'Sales', freshnessMode: 'scheduled', refreshFrequency: 'unknown', criticality: 'high', status: 'warning', notes: 'BQ + CRM cache fallback + Sheets plan', fileRef: 'src/app/sales/plan-fact/page.tsx' },
  { id: 'page_sales_brokers', type: 'page', title: '/sales/brokers', owner: 'Sales', freshnessMode: 'scheduled', refreshFrequency: 'unknown', criticality: 'high', status: 'warning', notes: 'Reads plan_fact BQ tables', fileRef: 'src/app/sales/brokers/page.tsx' },
  { id: 'page_partner_klykov', type: 'page', title: '/partners/klykov', owner: 'Partners', freshnessMode: 'realtime', refreshFrequency: 'live API', criticality: 'high', status: 'ok', notes: 'Live Kanban from AmoCRM + marketing stats', fileRef: 'src/app/partners/klykov/page.tsx' },
  { id: 'page_partner_fb', type: 'page', title: '/partners/facebook', owner: 'Partners', freshnessMode: 'realtime', refreshFrequency: 'live API', criticality: 'high', status: 'ok', notes: 'Live Kanban from AmoCRM', fileRef: 'src/app/partners/facebook/page.tsx' },

  { id: 'api_marketing', type: 'api', title: '/api/marketing', owner: 'Marketing', freshnessMode: 'scheduled', refreshFrequency: 'hourly', criticality: 'high', status: 'ok', notes: 'Reads marketing_channel_drilldown_daily', fileRef: 'src/app/api/marketing/route.ts' },
  { id: 'api_red_score', type: 'api', title: '/api/marketing/red-scoreboard', owner: 'Marketing', freshnessMode: 'scheduled', refreshFrequency: 'hourly', criticality: 'medium', status: 'ok', notes: 'Aggregates RED from drilldown table', fileRef: 'src/app/api/marketing/red-scoreboard/route.ts' },
  { id: 'api_red_geo', type: 'api', title: '/api/marketing/geo', owner: 'Marketing', freshnessMode: 'unknown', refreshFrequency: 'unknown', criticality: 'medium', status: 'risk', notes: 'Reads marketing_geo_creative_hub', fileRef: 'src/app/api/marketing/geo/route.ts' },
  { id: 'api_fb', type: 'api', title: '/api/marketing/facebook', owner: 'Marketing', freshnessMode: 'unknown', refreshFrequency: 'unknown', criticality: 'high', status: 'risk', notes: 'Reads amo_channel_leads_raw', fileRef: 'src/app/api/marketing/facebook/route.ts' },
  { id: 'api_fb_score', type: 'api', title: '/api/marketing/facebook-scoreboard', owner: 'Marketing', freshnessMode: 'unknown', refreshFrequency: 'unknown', criticality: 'medium', status: 'risk', notes: 'Reads amo_channel_leads_raw', fileRef: 'src/app/api/marketing/facebook-scoreboard/route.ts' },
  { id: 'api_pf_listings', type: 'api', title: '/api/pf-listings', owner: 'PF', freshnessMode: 'manual', refreshFrequency: 'manual + deploy', criticality: 'high', status: 'warning', notes: 'Reads PF JSON + BQ merge', fileRef: 'src/app/api/pf-listings/route.ts' },
  { id: 'api_pf_projects', type: 'api', title: '/api/pf-projects', owner: 'PF', freshnessMode: 'manual', refreshFrequency: 'manual + deploy', criticality: 'high', status: 'warning', notes: 'Reads PF project JSON + BQ merge', fileRef: 'src/app/api/pf-projects/route.ts' },
  { id: 'api_sales_overview', type: 'api', title: '/api/sales/overview', owner: 'Sales', freshnessMode: 'manual', refreshFrequency: 'depends on xlsx update', criticality: 'high', status: 'risk', notes: 'Parses local XLSX files', fileRef: 'src/app/api/sales/overview/route.ts' },
  { id: 'api_sales_dir', type: 'api', title: '/api/sales/directions', owner: 'Sales', freshnessMode: 'manual', refreshFrequency: 'depends on xlsx update', criticality: 'high', status: 'risk', notes: 'Parses local XLSX files', fileRef: 'src/app/api/sales/directions/route.ts' },
  { id: 'api_sales_pf', type: 'api', title: '/api/sales/plan-fact', owner: 'Sales', freshnessMode: 'scheduled', refreshFrequency: 'unknown', criticality: 'high', status: 'warning', notes: 'Reads plan_fact BQ + CRM cache fallback', fileRef: 'src/app/api/sales/plan-fact/route.ts' },
  { id: 'api_sales_brokers', type: 'api', title: '/api/sales/brokers', owner: 'Sales', freshnessMode: 'scheduled', refreshFrequency: 'unknown', criticality: 'high', status: 'warning', notes: 'Reads plan_fact BQ tables + Sheets plan', fileRef: 'src/app/api/sales/brokers/route.ts' },
  { id: 'api_partner_klykov', type: 'api', title: '/api/partners/klykov/leads', owner: 'Partners', freshnessMode: 'realtime', refreshFrequency: 'live API', criticality: 'high', status: 'ok', notes: 'Live leads from AmoCRM', fileRef: 'src/app/api/partners/klykov/leads/route.ts' },
  { id: 'api_partner_fb', type: 'api', title: '/api/partners/facebook/leads', owner: 'Partners', freshnessMode: 'realtime', refreshFrequency: 'live API', criticality: 'high', status: 'ok', notes: 'Live leads from AmoCRM', fileRef: 'src/app/api/partners/facebook/leads/route.ts' },

  { id: 'src_bq_drill', type: 'source', title: 'BQ marketing_channel_drilldown_daily', owner: 'Data', freshnessMode: 'scheduled', refreshFrequency: 'hourly', criticality: 'high', status: 'ok', notes: 'Main marketing aggregated table', fileRef: 'scripts/sync/sync_red_to_bq.mjs' },
  { id: 'src_bq_unified', type: 'source', title: 'BQ marketing_v2_leads', owner: 'Data', freshnessMode: 'scheduled', refreshFrequency: 'hourly', criticality: 'medium', status: 'ok', notes: 'Unified leads snapshot', fileRef: 'scripts/sync/sync_unified_leads.mjs' },
  { id: 'src_bq_amo_raw', type: 'source', title: 'BQ amo_channel_leads_raw', owner: 'Data', freshnessMode: 'unknown', refreshFrequency: 'unknown', criticality: 'high', status: 'risk', notes: 'Scheduler not confirmed in current workflow', fileRef: 'src/app/api/marketing/facebook/route.ts' },
  { id: 'src_bq_geo', type: 'source', title: 'BQ marketing_geo_creative_hub', owner: 'Data', freshnessMode: 'unknown', refreshFrequency: 'unknown', criticality: 'medium', status: 'risk', notes: 'Scheduler not confirmed in current workflow', fileRef: 'src/app/api/marketing/geo/route.ts' },
  { id: 'src_bq_pf_master', type: 'source', title: 'BQ pf_efficacy_master', owner: 'Data', freshnessMode: 'unknown', refreshFrequency: 'unknown', criticality: 'high', status: 'warning', notes: 'Used for PF CRM match metrics', fileRef: 'src/app/api/pf-listings/route.ts' },
  { id: 'src_bq_pf_leads', type: 'source', title: 'BQ plan_fact_crm_leads', owner: 'Data', freshnessMode: 'unknown', refreshFrequency: 'unknown', criticality: 'high', status: 'warning', notes: 'Plan/fact lead source', fileRef: 'src/app/api/sales/plan-fact/route.ts' },
  { id: 'src_bq_pf_tasks', type: 'source', title: 'BQ plan_fact_crm_tasks', owner: 'Data', freshnessMode: 'unknown', refreshFrequency: 'unknown', criticality: 'high', status: 'warning', notes: 'Plan/fact task source', fileRef: 'src/app/api/sales/plan-fact/route.ts' },
  { id: 'src_json_pf_listings', type: 'source', title: 'JSON pf_listings_report.json', owner: 'PF', freshnessMode: 'manual', refreshFrequency: 'manual + deploy', criticality: 'high', status: 'warning', notes: 'Listings snapshot from PF script', fileRef: 'pf_listings_report.json' },
  { id: 'src_json_pf_projects', type: 'source', title: 'JSON pf_projects_report.json', owner: 'PF', freshnessMode: 'manual', refreshFrequency: 'manual + deploy', criticality: 'high', status: 'warning', notes: 'Projects snapshot from PF script', fileRef: 'pf_projects_report.json' },
  { id: 'src_xlsx_offplan', type: 'source', title: 'Excel offplan.xlsx', owner: 'Sales', freshnessMode: 'manual', refreshFrequency: 'manual file update', criticality: 'high', status: 'risk', notes: 'Runtime source for sales overview/directions', fileRef: 'offplan.xlsx' },
  { id: 'src_xlsx_secondary', type: 'source', title: 'Excel secondary_rental.xlsx', owner: 'Sales', freshnessMode: 'manual', refreshFrequency: 'manual file update', criticality: 'high', status: 'risk', notes: 'Runtime source for sales overview/directions', fileRef: 'secondary_rental.xlsx' },
  { id: 'src_xlsx_support', type: 'source', title: 'Excel support.xlsx', owner: 'Sales', freshnessMode: 'manual', refreshFrequency: 'manual file update', criticality: 'high', status: 'risk', notes: 'Runtime source for sales overview/directions', fileRef: 'support.xlsx' },
  { id: 'src_cache_plan_data', type: 'source', title: 'Cache data/cache/plan-data/*.json', owner: 'Sales', freshnessMode: 'scheduled', refreshFrequency: 'API runtime cache', criticality: 'medium', status: 'warning', notes: 'Google Sheets plan cache files', fileRef: 'src/lib/sheets/planReader.ts' },

  { id: 'ext_bq', type: 'external', title: 'BigQuery', owner: 'External', freshnessMode: 'scheduled', refreshFrequency: 'depends on job', criticality: 'high', status: 'ok', notes: 'Primary analytics warehouse', fileRef: 'src/app/api/marketing/route.ts' },
  { id: 'ext_amo', type: 'external', title: 'AmoCRM API', owner: 'External', freshnessMode: 'realtime', refreshFrequency: 'live requests', criticality: 'high', status: 'ok', notes: 'Partner pages and some sync scripts', fileRef: 'src/lib/amo.ts' },
  { id: 'ext_sheets', type: 'external', title: 'Google Sheets API', owner: 'External', freshnessMode: 'realtime', refreshFrequency: 'API read + cache', criticality: 'medium', status: 'warning', notes: 'Plan/fact plan import path', fileRef: 'src/lib/sheets/planReader.ts' },
  { id: 'ext_pf_api', type: 'external', title: 'Property Finder API', owner: 'External', freshnessMode: 'manual', refreshFrequency: 'when script runs', criticality: 'medium', status: 'warning', notes: 'Used by active manual PF scripts', fileRef: 'scripts/pf_export_full_json.mjs' },
];

const EDGES: SystemEdge[] = [
  { from: 'page_marketing', to: 'api_marketing', type: 'calls' },
  { from: 'page_red', to: 'api_marketing', type: 'calls' },
  { from: 'page_red', to: 'api_red_score', type: 'calls' },
  { from: 'page_red', to: 'api_red_geo', type: 'calls' },
  { from: 'page_facebook', to: 'api_fb', type: 'calls' },
  { from: 'page_facebook', to: 'api_fb_score', type: 'calls' },
  { from: 'page_pf', to: 'api_pf_listings', type: 'calls' },
  { from: 'page_pf', to: 'api_pf_projects', type: 'calls' },
  { from: 'page_sales', to: 'api_sales_overview', type: 'calls' },
  { from: 'page_sales_dir', to: 'api_sales_dir', type: 'calls' },
  { from: 'page_sales_pf', to: 'api_sales_pf', type: 'calls' },
  { from: 'page_sales_brokers', to: 'api_sales_brokers', type: 'calls' },
  { from: 'page_partner_klykov', to: 'api_partner_klykov', type: 'calls' },
  { from: 'page_partner_klykov', to: 'api_marketing', type: 'calls' },
  { from: 'page_partner_fb', to: 'api_partner_fb', type: 'calls' },

  { from: 'api_marketing', to: 'src_bq_drill', type: 'reads_from' },
  { from: 'api_red_score', to: 'src_bq_drill', type: 'reads_from' },
  { from: 'api_red_geo', to: 'src_bq_geo', type: 'reads_from' },
  { from: 'api_fb', to: 'src_bq_amo_raw', type: 'reads_from' },
  { from: 'api_fb_score', to: 'src_bq_amo_raw', type: 'reads_from' },
  { from: 'api_pf_listings', to: 'src_json_pf_listings', type: 'reads_from' },
  { from: 'api_pf_listings', to: 'src_bq_pf_master', type: 'reads_from' },
  { from: 'api_pf_listings', to: 'src_bq_amo_raw', type: 'reads_from' },
  { from: 'api_pf_projects', to: 'src_json_pf_projects', type: 'reads_from' },
  { from: 'api_pf_projects', to: 'src_bq_pf_master', type: 'reads_from' },
  { from: 'api_sales_overview', to: 'src_xlsx_offplan', type: 'reads_from' },
  { from: 'api_sales_overview', to: 'src_xlsx_secondary', type: 'reads_from' },
  { from: 'api_sales_overview', to: 'src_xlsx_support', type: 'reads_from' },
  { from: 'api_sales_dir', to: 'src_xlsx_offplan', type: 'reads_from' },
  { from: 'api_sales_dir', to: 'src_xlsx_secondary', type: 'reads_from' },
  { from: 'api_sales_dir', to: 'src_xlsx_support', type: 'reads_from' },
  { from: 'api_sales_pf', to: 'src_bq_pf_leads', type: 'reads_from' },
  { from: 'api_sales_pf', to: 'src_bq_pf_tasks', type: 'reads_from' },
  { from: 'api_sales_pf', to: 'src_cache_plan_data', type: 'reads_from' },
  { from: 'api_sales_brokers', to: 'src_bq_pf_leads', type: 'reads_from' },
  { from: 'api_sales_brokers', to: 'src_bq_pf_tasks', type: 'reads_from' },
  { from: 'api_sales_brokers', to: 'src_cache_plan_data', type: 'reads_from' },

  { from: 'wf_data_sync', to: 'job_sync_red', type: 'scheduled_by' },
  { from: 'wf_data_sync', to: 'job_sync_klykov', type: 'scheduled_by' },
  { from: 'wf_data_sync', to: 'job_sync_unified', type: 'scheduled_by' },

  { from: 'job_sync_red', to: 'src_bq_drill', type: 'writes_to' },
  { from: 'job_sync_klykov', to: 'src_bq_drill', type: 'writes_to' },
  { from: 'job_sync_unified', to: 'src_bq_unified', type: 'writes_to' },
  { from: 'job_pf_listings', to: 'src_json_pf_listings', type: 'writes_to' },
  { from: 'job_pf_projects', to: 'src_json_pf_projects', type: 'writes_to' },
  { from: 'job_sync_plan_fact', to: 'src_bq_pf_leads', type: 'writes_to' },
  { from: 'job_sync_plan_fact', to: 'src_bq_pf_tasks', type: 'writes_to' },

  { from: 'api_marketing', to: 'ext_bq', type: 'uses' },
  { from: 'api_red_score', to: 'ext_bq', type: 'uses' },
  { from: 'api_red_geo', to: 'ext_bq', type: 'uses' },
  { from: 'api_fb', to: 'ext_bq', type: 'uses' },
  { from: 'api_sales_pf', to: 'ext_bq', type: 'uses' },
  { from: 'api_partner_klykov', to: 'ext_amo', type: 'uses' },
  { from: 'api_partner_fb', to: 'ext_amo', type: 'uses' },
  { from: 'job_sync_red', to: 'ext_amo', type: 'uses' },
  { from: 'job_sync_klykov', to: 'ext_amo', type: 'uses' },
  { from: 'job_pf_listings', to: 'ext_pf_api', type: 'uses' },
  { from: 'job_pf_projects', to: 'ext_pf_api', type: 'uses' },
  { from: 'api_sales_pf', to: 'ext_sheets', type: 'uses' },
  { from: 'api_sales_brokers', to: 'ext_sheets', type: 'uses' },
];

const LANE_ORDER: Array<{ type: NodeType; label: string }> = [
  { type: 'page', label: 'Pages' },
  { type: 'api', label: 'API' },
  { type: 'source', label: 'Data Sources' },
  { type: 'job', label: 'Sync Jobs' },
  { type: 'workflow', label: 'Workflows' },
  { type: 'external', label: 'External Services' },
];

const EDGE_TYPE_LABEL: Record<EdgeType, string> = {
  calls: 'calls',
  reads_from: 'reads_from',
  writes_to: 'writes_to',
  scheduled_by: 'scheduled_by',
  uses: 'uses',
};

const STATUS_LABEL: Record<NodeStatus, string> = {
  ok: 'OK',
  warning: 'Warning',
  risk: 'Risk',
};

export default function DeveloperPage() {
  const [search, setSearch] = useState('');
  const [edgeFilter, setEdgeFilter] = useState<'all' | EdgeType>('all');

  const nodeMap = useMemo(() => new Map(NODES.map((n) => [n.id, n])), []);

  const filteredNodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return NODES;
    return NODES.filter((n) =>
      [n.title, n.owner, n.notes, n.fileRef, n.refreshFrequency].join(' | ').toLowerCase().includes(q),
    );
  }, [search]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    return EDGES.filter((e) => {
      if (edgeFilter !== 'all' && e.type !== edgeFilter) return false;
      return filteredNodeIds.has(e.from) && filteredNodeIds.has(e.to);
    });
  }, [edgeFilter, filteredNodeIds]);

  const totals = useMemo(() => {
    const ok = NODES.filter((n) => n.status === 'ok').length;
    const warning = NODES.filter((n) => n.status === 'warning').length;
    const risk = NODES.filter((n) => n.status === 'risk').length;
    return {
      all: NODES.length,
      ok,
      warning,
      risk,
      edges: EDGES.length,
    };
  }, []);

  return (
    <DashboardPage
      title="Developer: System Map (AS-IS)"
      hideTable={true}
      hideSourceFilter={true}
      hideFilters={true}
    >
      <div className={styles.wrapper}>
        <div className={styles.metaGrid}>
          <div className={styles.metaCard}>
            <div className={styles.metaLabel}>Total Nodes</div>
            <div className={styles.metaValue}>{totals.all}</div>
          </div>
          <div className={styles.metaCard}>
            <div className={styles.metaLabel}>OK</div>
            <div className={styles.metaValue}>{totals.ok}</div>
          </div>
          <div className={styles.metaCard}>
            <div className={styles.metaLabel}>Warning</div>
            <div className={styles.metaValue}>{totals.warning}</div>
          </div>
          <div className={styles.metaCard}>
            <div className={styles.metaLabel}>Risk</div>
            <div className={styles.metaValue}>{totals.risk}</div>
          </div>
          <div className={styles.metaCard}>
            <div className={styles.metaLabel}>Total Edges</div>
            <div className={styles.metaValue}>{totals.edges}</div>
          </div>
        </div>

        <div className={styles.controls}>
          <input
            className={styles.input}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, owner, file..."
          />
          <select
            className={styles.select}
            value={edgeFilter}
            onChange={(e) => setEdgeFilter(e.target.value as 'all' | EdgeType)}
          >
            <option value="all">All edge types</option>
            <option value="calls">calls</option>
            <option value="reads_from">reads_from</option>
            <option value="writes_to">writes_to</option>
            <option value="scheduled_by">scheduled_by</option>
            <option value="uses">uses</option>
          </select>
        </div>

        <div className={styles.laneGrid}>
          {LANE_ORDER.map((lane) => {
            const laneNodes = filteredNodes.filter((n) => n.type === lane.type);
            return (
              <section key={lane.type} className={styles.lane}>
                <div className={styles.laneHeader}>
                  <h3>{lane.label}</h3>
                  <span>{laneNodes.length}</span>
                </div>
                <div className={styles.cards}>
                  {laneNodes.map((node) => (
                    <article key={node.id} className={styles.card} data-status={node.status}>
                      <div className={styles.cardHead}>
                        <div className={styles.cardTitle}>{node.title}</div>
                        <span className={styles.badge}>{STATUS_LABEL[node.status]}</span>
                      </div>
                      <div className={styles.cardMeta}>
                        <span>{node.type}</span>
                        <span>{node.owner}</span>
                      </div>
                      <div className={styles.row}><strong>Refresh:</strong> {node.refreshFrequency}</div>
                      <div className={styles.row}><strong>Mode:</strong> {node.freshnessMode}</div>
                      <div className={styles.notes}>{node.notes}</div>
                      <div className={styles.fileRef}>{node.fileRef}</div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <section className={styles.edgesSection}>
          <div className={styles.laneHeader}>
            <h3>Connections</h3>
            <span>{filteredEdges.length}</span>
          </div>
          <div className={styles.edgeTable}>
            {filteredEdges.map((edge, idx) => {
              const from = nodeMap.get(edge.from);
              const to = nodeMap.get(edge.to);
              if (!from || !to) return null;
              return (
                <div className={styles.edgeRow} key={`${edge.from}-${edge.to}-${edge.type}-${idx}`}>
                  <div className={styles.edgeCell}>{from.title}</div>
                  <div className={styles.edgeType}>{EDGE_TYPE_LABEL[edge.type]}</div>
                  <div className={styles.edgeCell}>{to.title}</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </DashboardPage>
  );
}
