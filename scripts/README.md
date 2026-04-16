# Scripts Map

## Canonical Production Scripts

- `sync/sync_plan_fact_bq.mjs` — plan/fact sync into BigQuery
- `sync/sync_brokers_bq.mjs` — broker sync into BigQuery
- `pf_listings_report_auto.mjs` — automated Property Finder report refresh

## Support Zones

- `audit/` — data inspection and troubleshooting helpers
- `debug/` — one-off debugging tools
- `verify/` — validation checks
- `kpi/` — KPI-related support scripts

## Rule

If a task is recurring or production-facing, prefer `scripts/sync`. If it is an investigation, use `audit`, `debug`, or `verify` and do not treat those scripts as the primary production path.