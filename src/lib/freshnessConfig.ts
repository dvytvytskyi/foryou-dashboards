export type FreshnessKind = 'bigquery' | 'file';

export type BqFreshnessSource = {
  id: string;
  kind: 'bigquery';
  table: string;
  expectedRefreshMinutes: number | null;
  owner: 'marketing' | 'sales' | 'pf' | 'infra';
};

export type FileFreshnessSource = {
  id: string;
  kind: 'file';
  filePath: string;
  expectedRefreshMinutes: number | null;
  owner: 'marketing' | 'sales' | 'pf' | 'infra';
};

export type FreshnessSource = BqFreshnessSource | FileFreshnessSource;

export const FRESHNESS_SOURCES: FreshnessSource[] = [
  {
    id: 'bq_marketing_channel_drilldown_daily',
    kind: 'bigquery',
    table: 'foryou_analytics.marketing_channel_drilldown_daily',
    expectedRefreshMinutes: 60,
    owner: 'marketing',
  },
  {
    id: 'bq_marketing_v2_leads',
    kind: 'bigquery',
    table: 'foryou_analytics.marketing_v2_leads',
    expectedRefreshMinutes: 60,
    owner: 'marketing',
  },
  {
    id: 'bq_amo_channel_leads_raw',
    kind: 'bigquery',
    table: 'foryou_analytics.amo_channel_leads_raw',
    expectedRefreshMinutes: null,
    owner: 'marketing',
  },
  {
    id: 'bq_marketing_geo_creative_hub',
    kind: 'bigquery',
    table: 'foryou_analytics.marketing_geo_creative_hub',
    expectedRefreshMinutes: null,
    owner: 'marketing',
  },
  {
    id: 'bq_pf_efficacy_master',
    kind: 'bigquery',
    table: 'foryou_analytics.pf_efficacy_master',
    expectedRefreshMinutes: null,
    owner: 'pf',
  },
  {
    id: 'bq_plan_fact_crm_leads',
    kind: 'bigquery',
    table: 'foryou_analytics.plan_fact_crm_leads',
    expectedRefreshMinutes: null,
    owner: 'sales',
  },
  {
    id: 'bq_plan_fact_crm_tasks',
    kind: 'bigquery',
    table: 'foryou_analytics.plan_fact_crm_tasks',
    expectedRefreshMinutes: null,
    owner: 'sales',
  },
  {
    id: 'file_pf_listings_report',
    kind: 'file',
    filePath: 'pf_listings_report.json',
    expectedRefreshMinutes: null,
    owner: 'pf',
  },
  {
    id: 'file_pf_projects_report',
    kind: 'file',
    filePath: 'pf_projects_report.json',
    expectedRefreshMinutes: null,
    owner: 'pf',
  },
  {
    id: 'file_sales_offplan',
    kind: 'file',
    filePath: 'offplan.xlsx',
    expectedRefreshMinutes: null,
    owner: 'sales',
  },
  {
    id: 'file_sales_secondary_rental',
    kind: 'file',
    filePath: 'secondary_rental.xlsx',
    expectedRefreshMinutes: null,
    owner: 'sales',
  },
  {
    id: 'file_sales_support',
    kind: 'file',
    filePath: 'support.xlsx',
    expectedRefreshMinutes: null,
    owner: 'sales',
  },
];
