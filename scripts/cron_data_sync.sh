#!/bin/bash
cd "$(dirname "$0")/.."

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "--- Starting Hourly Data Sync ---"
date

node scripts/ci/bootstrap_amo_tokens_from_db.mjs
node scripts/kpi/refresh_amo_token.mjs
node scripts/kpi/sync_amo_channel_leads_raw.mjs
node scripts/sync/sync_red_to_bq.mjs
node scripts/sync/sync_klykov_to_bq.mjs
node scripts/kpi/create_unified_marketing_drilldown_daily.mjs
node scripts/kpi/create_partners_drilldown_daily.mjs
node scripts/kpi/sync_pf_amo_project_match.mjs
node scripts/sync/sync_unified_leads.mjs
npm run sync:plan-fact:bq
node scripts/sync/sync_milestones_bq.mjs
npm run check:marketing:freshness

echo "--- Finished Hourly Data Sync ---"
date
