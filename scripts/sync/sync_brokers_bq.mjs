#!/usr/bin/env node

import { BigQuery } from '@google-cloud/bigquery';
import fs from 'fs/promises';
import path from 'path';
import { CLOSED_DEAL_STATUS_IDS } from '../../src/lib/crmRules.js';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SOURCE_LEADS_TABLE = 'plan_fact_crm_leads';
const SOURCE_TASKS_TABLE = 'plan_fact_crm_tasks';
const DEST_METRICS_TABLE = 'brokers_metrics_lifetime';

const bq = new BigQuery({
  projectId: PROJECT_ID,
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
});

const WON_STATUS_SQL = CLOSED_DEAL_STATUS_IDS.join(', ');
const LOST_STATUS_ID = 143;

const RE_PIPELINE_ID = 8696950;
const KLYKOV_PIPELINE_ID = 10776450;

const RE_QL_STATUSES = [
  70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586,
  74717798, 74717802, 70457490, 82310010, 142,
];
const KL_QL_STATUSES = [
  84853934, 84853938, 84853942, 84853946, 84853950, 84853954, 84853958, 84853962, 84853966,
];

const RE_SHOWING_STATUSES = [70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802];
const KL_SHOWING_STATUSES = [84853942, 84853946, 84853950, 84853954, 84853958, 84853962, 84853966];

async function syncBrokersMetrics() {
  try {
    console.log('🔄 Syncing brokers metrics...');

    // Create or replace materialized table for brokers metrics
    const createTableQuery = `
      CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET_ID}.${DEST_METRICS_TABLE}\` AS
      SELECT
        l.responsible_user_id as broker_id,
        l.broker_name,
        l.source_name,
        COUNT(DISTINCT l.lead_id) as total_leads,
        COUNTIF(
          CASE
            WHEN l.pipeline_id = ${RE_PIPELINE_ID} THEN l.status_id IN (${Array.from(RE_QL_STATUSES).join(',')})
            WHEN l.pipeline_id = ${KLYKOV_PIPELINE_ID} THEN l.status_id IN (${Array.from(KL_QL_STATUSES).join(',')})
            ELSE FALSE
          END
        ) as ql_leads,
        COUNTIF(
          CASE
            WHEN l.pipeline_id = ${RE_PIPELINE_ID} THEN l.status_id IN (${Array.from(RE_SHOWING_STATUSES).join(',')})
            WHEN l.pipeline_id = ${KLYKOV_PIPELINE_ID} THEN l.status_id IN (${Array.from(KL_SHOWING_STATUSES).join(',')})
            ELSE FALSE
          END
        ) as showing_leads,
        COUNTIF(l.status_id IN (${WON_STATUS_SQL})) as won_leads,
        COUNTIF(l.status_id = ${LOST_STATUS_ID}) as lost_leads,
        COALESCE(SUM(l.price), 0) as total_revenue,
        CURRENT_TIMESTAMP() as synced_at
      FROM \`${PROJECT_ID}.${DATASET_ID}.${SOURCE_LEADS_TABLE}\` l
      GROUP BY l.responsible_user_id, l.broker_name, l.source_name
      ORDER BY l.broker_name, l.source_name;
    `;

    await bq.query({
      query: createTableQuery,
      useLegacySql: false,
    });

    console.log('✅ Brokers metrics table created/updated');

    // Create table for overdue tasks by broker
    const createTasksQuery = `
      CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET_ID}.brokers_overdue_tasks\` AS
      SELECT
        t.responsible_user_id as broker_id,
        t.task_id,
        t.entity_id as lead_id,
        t.complete_till,
        CURRENT_TIMESTAMP() as synced_at
      FROM \`${PROJECT_ID}.${DATASET_ID}.${SOURCE_TASKS_TABLE}\` t
      WHERE t.is_completed = FALSE AND t.complete_till < CURRENT_TIMESTAMP()
      ORDER BY t.complete_till ASC;
    `;

    await bq.query({
      query: createTasksQuery,
      useLegacySql: false,
    });

    console.log('✅ Overdue tasks table created/updated');

    // Get summary statistics
    const [summaryRows] = await bq.query({
      query: `
        SELECT
          COUNT(DISTINCT broker_id) as total_brokers,
          SUM(total_leads) as total_leads_count,
          SUM(ql_leads) as total_ql_count,
          SUM(won_leads) as total_won_count,
          SUM(total_revenue) as total_revenue
        FROM \`${PROJECT_ID}.${DATASET_ID}.${DEST_METRICS_TABLE}\`;
      `,
      useLegacySql: false,
    });

    const summary = summaryRows[0];
    console.log('📊 Summary:', {
      total_brokers: summary.total_brokers,
      total_leads: summary.total_leads_count,
      total_ql: summary.total_ql_count,
      total_won: summary.total_won_count,
      total_revenue: summary.total_revenue,
    });

    console.log('✨ Sync complete!');
  } catch (error) {
    console.error('❌ Sync failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

syncBrokersMetrics();
