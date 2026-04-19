# Scripts Map

## Canonical Production Scripts

- `sync/sync_plan_fact_bq.mjs` — plan/fact sync into BigQuery
- `sync/sync_brokers_bq.mjs` — broker sync into BigQuery
- `sync/sync_pf_to_postgres.mjs` — Property Finder sync into Postgres
- `kpi/sync_pf_final_fix.mjs` — full PF leads sync into BigQuery raw table
- `kpi/create_pf_master_view.mjs` — PF to CRM phone matching view
- `pf_export_full_json.mjs` — consolidated PF export with dual KPI

## Support Zones

- `audit/` — data inspection and troubleshooting helpers
- `debug/` — one-off debugging tools
- `verify/` — validation checks
- `kpi/` — KPI-related support scripts

## Rule

If a task is recurring or production-facing, prefer `scripts/sync`. If it is an investigation, use `audit`, `debug`, or `verify` and do not treat those scripts as the primary production path.