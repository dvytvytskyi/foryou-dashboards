# Data Refresh Table

| Источник | Скрипти | Частота оновлень |
|---|---|---|
| BigQuery: `foryou_analytics.marketing_channel_drilldown_daily` (канал RED) | `scripts/sync/sync_red_to_bq.mjs` (через `.github/workflows/data-sync.yml`) | Щогодини (`cron: 0 * * * *`) |
| BigQuery: `foryou_analytics.marketing_channel_drilldown_daily` (канал Klykov) | `scripts/sync/sync_klykov_to_bq.mjs` (через `.github/workflows/data-sync.yml`) | Щогодини (`cron: 0 * * * *`) |
| BigQuery: `foryou_analytics.marketing_v2_leads` | `scripts/sync/sync_unified_leads.mjs` (через `.github/workflows/data-sync.yml`) | Щогодини (`cron: 0 * * * *`) |
| BigQuery: `foryou_analytics.amo_channel_leads_raw` | Немає явного скрипта у поточному scheduler workflow | Невідомо / не підтверджено в цьому репо |
| BigQuery: `foryou_analytics.marketing_geo_creative_hub` | Немає явного скрипта у поточному scheduler workflow | Невідомо / не підтверджено в цьому репо |
| JSON файл: `pf_listings_report.json` | Є ручний скрипт `scripts/pf_listings_report_auto.mjs`, але НЕ підключений у `.github/workflows/data-sync.yml` | Автооновлення: Немає. Тільки вручну (коли запускають скрипт + деплой) |
| JSON файл: `pf_projects_report.json` | Є ручний скрипт `scripts/kpi/generate_pf_projects_report.mjs`, але НЕ підключений у `.github/workflows/data-sync.yml` | Автооновлення: Немає. Тільки вручну (коли запускають скрипт + деплой) |
| Excel файл: `offplan.xlsx` | Скрипт автооновлення у workflow: Порожньо | Автооновлення: Немає (API читає файл як є на сервері) |
| Excel файл: `secondary_rental.xlsx` | Скрипт автооновлення у workflow: Порожньо | Автооновлення: Немає (API читає файл як є на сервері) |
| Excel файл: `support.xlsx` | Скрипт автооновлення у workflow: Порожньо | Автооновлення: Немає (API читає файл як є на сервері) |
| BigQuery: `foryou_analytics.plan_fact_crm_leads` | `scripts/sync/sync_plan_fact_bq.mjs` (є в repo scripts) | Частота в GitHub Actions: Порожньо (не знайдено scheduler/step) |
| BigQuery: `foryou_analytics.plan_fact_crm_tasks` | `scripts/sync/sync_plan_fact_bq.mjs` (є в repo scripts) | Частота в GitHub Actions: Порожньо (не знайдено scheduler/step) |
| BigQuery: `foryou_analytics.brokers_metrics` / `brokers_overdue_tasks` | `scripts/sync/sync_brokers_bq.mjs` (є в repo scripts) | Частота в GitHub Actions: Порожньо (не знайдено scheduler/step) |
| Google Sheets (план брокерів, читається в runtime) | Скрипт sync не потрібен: читання напряму через `src/lib/sheets/planReader.ts` + кеш у `data/cache/plan-data/*.json` | При кожному запиті API (з кешем файлу; TTL у коді для plan cache явно не заданий) |
