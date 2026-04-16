# Active Initial Sources (Real Project)

Дата фіксації: 2026-04-16

## 1) Підтверджені потоки: що реально пишеться в BigQuery

| BQ таблиця (target) | Первинний source | Тип source | Скрипт/процес | Частота | Статус |
|---|---|---|---|---|---|
| `foryou_analytics.marketing_channel_drilldown_daily` (channel=RED) | AmoCRM pipeline `8696950` + UTM поля в лідах | CRM API | `scripts/sync/sync_red_to_bq.mjs` через `.github/workflows/data-sync.yml` | Щогодини (`0 * * * *`) | Підтверджено |
| `foryou_analytics.marketing_channel_drilldown_daily` (channel=Klykov) | AmoCRM pipeline `10776450` | CRM API | `scripts/sync/sync_klykov_to_bq.mjs` через `.github/workflows/data-sync.yml` | Щогодини (`0 * * * *`) | Підтверджено |
| `foryou_analytics.marketing_v2_leads` | AmoCRM pipelines: `8696950`, `10776450`, `10633838`, `8550470`, `10651778` | CRM API | `scripts/sync/sync_unified_leads.mjs` через `.github/workflows/data-sync.yml` | Щогодини (`0 * * * *`) | Підтверджено |
| `foryou_analytics.plan_fact_crm_leads` | AmoCRM pipelines `8696950`, `10776450` | CRM API | `scripts/sync/sync_plan_fact_bq.mjs` | У workflow не знайдено | Скрипт є, scheduler не підтверджено |
| `foryou_analytics.plan_fact_crm_tasks` | AmoCRM tasks (`/api/v4/tasks`) | CRM API | `scripts/sync/sync_plan_fact_bq.mjs` | У workflow не знайдено | Скрипт є, scheduler не підтверджено |
| `foryou_analytics.brokers_metrics_lifetime` | `plan_fact_crm_leads` (BQ) | BQ->BQ transform | `scripts/sync/sync_brokers_bq.mjs` | У workflow не знайдено | Скрипт є, scheduler не підтверджено |
| `foryou_analytics.brokers_overdue_tasks` | `plan_fact_crm_tasks` (BQ) | BQ->BQ transform | `scripts/sync/sync_brokers_bq.mjs` | У workflow не знайдено | Скрипт є, scheduler не підтверджено |

## 2) BQ таблиці, які активно читаються API, але ingest зараз не підтверджений у поточному scheduler

| BQ таблиця | Де використовується | Імовірний первинний source | Частота ingest | Статус |
|---|---|---|---|---|
| `foryou_analytics.amo_channel_leads_raw` | `/api/marketing/facebook`, `/api/marketing/facebook-scoreboard`, `/api/pf-listings` | AmoCRM leads | Невідомо | Не знайдено явного активного sync у поточному workflow |
| `foryou_analytics.marketing_geo_creative_hub` | `/api/marketing/geo` | Маркетинг/ліди з гео-атрибуцією | Невідомо | Не знайдено явного активного sync у поточному workflow |
| `foryou_analytics.pf_efficacy_master` | `/api/pf-listings`, `/api/pf-projects` | Матчинг PF + CRM | Невідомо | Не знайдено явного активного sync у поточному workflow |

## 3) Активні первинні джерела в проекті, які не пишуться напряму в BQ цими workflow

| Первинний source | Куди йде | Процес | Частота | Статус |
|---|---|---|---|---|
| Property Finder API | `pf_listings_report.json` | `scripts/pf_listings_report_auto.mjs` | Вручну | Активно, але manual |
| Property Finder API | `pf_projects_report.json` | `scripts/kpi/generate_pf_projects_report.mjs` | Вручну | Активно, але manual |
| Google Sheets (план брокерів) | Runtime API (`/api/sales/plan-fact`, `/api/sales/brokers`) + кеш `data/cache/plan-data/*.json` | `src/lib/sheets/planReader.ts` | На запит API (з кешуванням) | Активно, не BQ ingest |
| Excel файли: `offplan.xlsx`, `secondary_rental.xlsx`, `support.xlsx` | Runtime API (`/api/sales/overview`, `/api/sales/directions`) | Пряме читання xlsx у route | На запит API | Активно, file-based runtime |

## 4) Що вважати "актуальним" у цьому документі

- "Підтверджено" = є конкретний workflow step у `.github/workflows/data-sync.yml`.
- "Скрипт є, scheduler не підтверджено" = скрипт production-класу є в repo, але не підключений у поточний scheduler workflow.
- "Не знайдено явного активного sync" = таблиця активно читається API, але в поточному scheduler не видно хто саме її оновлює.
