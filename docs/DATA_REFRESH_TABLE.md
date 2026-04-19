# Data Refresh Table

| Источник | Скрипти | Частота оновлень |
|---|---|---|
| BigQuery: `foryou_analytics.marketing_channel_drilldown_daily` (канал RED) | `scripts/sync/sync_red_to_bq.mjs` (через `.github/workflows/data-sync.yml`) | Щогодини (`cron: 0 * * * *`) |
| BigQuery: `foryou_analytics.marketing_channel_drilldown_daily` (канал Klykov) | `scripts/sync/sync_klykov_to_bq.mjs` (через `.github/workflows/data-sync.yml`) | Щогодини (`cron: 0 * * * *`) |
| BigQuery: `foryou_analytics.marketing_v2_leads` | `scripts/sync/sync_unified_leads.mjs` (через `.github/workflows/data-sync.yml`) | Щогодини (`cron: 0 * * * *`) |
| BigQuery: `foryou_analytics.amo_channel_leads_raw` | Немає явного скрипта у поточному scheduler workflow | Невідомо / не підтверджено в цьому репо |
| BigQuery: `foryou_analytics.marketing_geo_creative_hub` | Немає явного скрипта у поточному scheduler workflow | Невідомо / не підтверджено в цьому репо |
| BigQuery: `foryou_analytics.pf_leads_raw` | Ручний скрипт `scripts/kpi/sync_pf_final_fix.mjs` | Автооновлення: Немає. Тільки вручну |
| BigQuery: `foryou_analytics.pf_efficacy_master` | Ручний скрипт `scripts/kpi/create_pf_master_view.mjs` | Автооновлення: Немає. Тільки вручну |
| JSON файл: `data/exports/pf_full_export_latest.json` | Ручний скрипт `scripts/pf_export_full_json.mjs` | Автооновлення: Немає. Тільки вручну |
| Excel файл: `offplan.xlsx` | Скрипт автооновлення у workflow: Порожньо | Автооновлення: Немає (API читає файл як є на сервері) |
| Excel файл: `secondary_rental.xlsx` | Скрипт автооновлення у workflow: Порожньо | Автооновлення: Немає (API читає файл як є на сервері) |
| Excel файл: `support.xlsx` | Скрипт автооновлення у workflow: Порожньо | Автооновлення: Немає (API читає файл як є на сервері) |
| BigQuery: `foryou_analytics.plan_fact_crm_leads` | `scripts/sync/sync_plan_fact_bq.mjs` (є в repo scripts) | Частота в GitHub Actions: Порожньо (не знайдено scheduler/step) |
| BigQuery: `foryou_analytics.plan_fact_crm_tasks` | `scripts/sync/sync_plan_fact_bq.mjs` (є в repo scripts) | Частота в GitHub Actions: Порожньо (не знайдено scheduler/step) |
| BigQuery: `foryou_analytics.brokers_metrics` / `brokers_overdue_tasks` | `scripts/sync/sync_brokers_bq.mjs` (є в repo scripts) | Частота в GitHub Actions: Порожньо (не знайдено scheduler/step) |
| Google Sheets (план брокерів, читається в runtime) | Скрипт sync не потрібен: читання напряму через `src/lib/sheets/planReader.ts` + кеш у `data/cache/plan-data/*.json` | При кожному запиті API (з кешем файлу; TTL у коді для plan cache явно не заданий) |
