# Data Sources By Page

Дата оновлення: 2026-04-16

## Коротка відповідь по актуальності даних

- Marketing / Red / Facebook: дані йдуть з BigQuery таблиць і зазвичай актуальні настільки, наскільки актуальний останній sync у BQ.
- Property Finder (PF): частина даних береться з локальних JSON файлів (`pf_listings_report.json`, `pf_projects_report.json`), тому може бути застарілою, якщо ці файли не були перегенеровані і задеплоєні.
- Sales Overview / Sales Directions: читають локальні Excel файли (`offplan.xlsx`, `secondary_rental.xlsx`, `support.xlsx`) у рантаймі. Актуальність залежить від того, чи ці файли оновлені на сервері.
- Website: зараз це мок-дані (hardcoded JSON у route), не live-інтеграція.

## Автооновлення, яке є зараз

### GitHub Actions

- `.github/workflows/data-sync.yml`
- Запуск: щогодини (`cron: '0 * * * *'`)
- Що синкається в межах цього workflow:
  - `node scripts/sync/sync_red_to_bq.mjs`
  - `node scripts/sync/sync_klykov_to_bq.mjs`
  - `node scripts/sync/sync_unified_leads.mjs`

### Що НЕ оновлюється автоматично цим workflow

- `pf_listings_report.json`
- `pf_projects_report.json`
- `offplan.xlsx`, `secondary_rental.xlsx`, `support.xlsx`

## Карта сторінок: що використовує кожна

## 1) Home

- Сторінка: `src/app/page.tsx`
- Поведінка: одразу `redirect('/marketing')`
- Джерела даних: немає

## 2) Login

- Сторінка: `src/app/login/page.tsx`
- API:
  - `/api/auth/login` (`src/app/api/auth/login/route.ts`)
  - `/api/auth/session` (`src/app/api/auth/session/route.ts`)
- Джерела:
  - Статичний список користувачів у `src/lib/users.ts`
  - Сесія в JWT cookie через `src/lib/auth.ts`
- CRM/BQ: ні
- Актуальність: статична (оновлюється тільки через зміну коду/деплой)

## 3) Marketing Analytics

- Сторінка: `src/app/marketing/page.tsx`
- Компонент `DashboardPage` за замовчуванням ходить у `/api/marketing`
- API: `src/app/api/marketing/route.ts`
- Основний SQL:
  - Таблиця: `crypto-world-epta.foryou_analytics.marketing_channel_drilldown_daily`
  - Фільтри: `report_date BETWEEN @startDate AND @endDate`, `channel IN UNNEST(@channels)`
- Джерело: BigQuery
- CRM: непрямо (через підготовлені дані в BQ)
- Актуальність: залежить від свіжості таблиці `marketing_channel_drilldown_daily`

## 4) Red Leads

- Сторінка: `src/app/red/page.tsx`
- API:
  - `/api/marketing` (основна таблиця каналу RED)
  - `/api/marketing/red-scoreboard`
  - `/api/marketing/geo`
- Джерела:
  - `marketing_channel_drilldown_daily` (scoreboard RED)
  - `marketing_geo_creative_hub` (geo/phone зріз)
- Логіка:
  - Scoreboard рахує поточний період і попередній аналогічний період
  - Geo API витягує останній стан ліда через `ROW_NUMBER()` по `lead_id`
- Актуальність: BigQuery-based (зазвичай близько до останнього sync)

## 5) Facebook Leads

- Сторінка: `src/app/facebook/page.tsx`
- API:
  - `/api/marketing/facebook`
  - `/api/marketing/facebook-scoreboard`
- Джерела:
  - Таблиця: `crypto-world-epta.foryou_analytics.amo_channel_leads_raw`
  - Фільтр джерела: `REGEXP_CONTAINS(..., '(facebook|meta|\\bfb\\b)')`
- Логіка deals/revenue:
  - Deals: `status_id = 142`
  - Revenue: `SUM(IF(status_id = 142, price, 0))`
- Актуальність: BigQuery-based

## 6) Website Traffic & Conversions

- Сторінка: `src/app/website/page.tsx`
- API: `/api/marketing/website` (`src/app/api/marketing/website/route.ts`)
- Джерело:
  - Hardcoded mock JSON у самому route
- CRM/BQ: ні
- Актуальність: не live, не автооновлюється

## 7) Property Finder (main)

- Сторінка: `src/app/property-finder/page.tsx`
- API:
  - `/api/pf-listings?group=Our`
  - `/api/pf-listings?group=Partner&startDate=...&endDate=...`
  - `/api/pf-projects?startDate=...&endDate=...`

### 7.1) PF Listings API

- Файл: `src/app/api/pf-listings/route.ts`
- Джерела:
  - Локальний файл: `pf_listings_report.json`
  - BigQuery:
    - `foryou_analytics.pf_efficacy_master`
    - `foryou_analytics.amo_channel_leads_raw`
- Що робить:
  - Читає список лістингів і бюджети з JSON
  - Тягне CRM-метрики з BQ та матчить по `listing_ref`
  - Мерджить це в один response для DashboardPage
- Важлива деталь:
  - Для помісячних бюджетів `BudgetByMonth` ліди/угоди додаються лише в latest month запис (`isLatest`)

### 7.2) PF Projects API

- Файл: `src/app/api/pf-projects/route.ts`
- Джерела:
  - Локальний файл: `pf_projects_report.json`
  - BigQuery: `foryou_analytics.pf_efficacy_master`
- Що робить:
  - Читає проєкти/райони з JSON
  - Підтягує CRM метрики з BQ
  - Мерджить у структуру District -> Project -> Month

### 7.3) Актуальність PF

- Потенційно застаріває саме JSON-частина (`pf_listings_report.json`, `pf_projects_report.json`)
- Актуальні скрипти refresh:
  - `scripts/kpi/sync_pf_final_fix.mjs` (повний PF leads ingest у BQ)
  - `scripts/kpi/create_pf_master_view.mjs` (phone matching view)
  - `scripts/pf_export_full_json.mjs` (повний PF export із dual KPI)
- В `.github/workflows/data-sync.yml` ці кроки не запускаються
- Висновок: PF потребує окремого manual refresh

## 8) Property Finder Primary Plus (окрема сторінка)

- Сторінка: `src/app/property-finder/primary-plus/page.tsx`
- API: `/api/pf-projects`
- Джерела/актуальність: ті самі, що у розділі PF Projects

## 9) Sales Overview

- Сторінка: `src/app/sales/page.tsx`
- API: `/api/sales/overview` (`src/app/api/sales/overview/route.ts`)
- Джерела:
  - Локальні Excel файли у корені проекту:
    - `offplan.xlsx`
    - `secondary_rental.xlsx` (лист 1 і лист 2)
    - `support.xlsx`
- Що рахує:
  - Scoreboard, брокери, партнери, breakdown по типах/джерелах
- CRM/BQ: ні (у цьому route)
- Актуальність: залежить від актуальності Excel файлів на проді

## 10) Sales Directions

- Сторінка: `src/app/sales/directions/page.tsx`
- API: `/api/sales/directions` (`src/app/api/sales/directions/route.ts`)
- Джерела:
  - Ті самі Excel (`offplan.xlsx`, `secondary_rental.xlsx`, `support.xlsx`)
- Важлива деталь:
  - Частина витрат зараз підставляється моком у коді (коментар TODO про інтеграцію)
- Актуальність: частково file-based + частково ручні числа

## 11) Sales Plan / Fact

- Сторінка: `src/app/sales/plan-fact/page.tsx`
- API: `/api/sales/plan-fact` (`src/app/api/sales/plan-fact/route.ts`)
- Джерела:
  - BigQuery:
    - `foryou_analytics.plan_fact_crm_leads`
    - `foryou_analytics.plan_fact_crm_tasks`
  - Fallback cache/CRM:
    - `data/cache/plan-fact/raw_leads.json`
    - `secrets/amo_tokens.json` + AmoCRM API
  - План із Google Sheets через `src/lib/sheets/planReader.ts`
    - Spreadsheet ID: `1HFUfawJrKBcReCn8DYOX-SayhSYvE6IkmYwe1Xjp7e4`
    - Кеш плану: `data/cache/plan-data/*.json`
- Актуальність:
  - Основна: BigQuery
  - Якщо BQ недоступний: fallback на кеш/CRM
  - План залежить від актуальності таблиці Google Sheets + кешу

## 12) Sales Brokers

- Сторінка: `src/app/sales/brokers/page.tsx`
- API:
  - `/api/sales/brokers` (список брокерів)
  - `/api/sales/brokers?brokerId=...&brokerName=...&startDate=...&endDate=...` (метрики)
- Джерела:
  - BigQuery:
    - `foryou_analytics.plan_fact_crm_leads`
    - `foryou_analytics.plan_fact_crm_tasks`
  - План з Google Sheets через `readPlanDataFromSheets(...)`
- Актуальність: BigQuery + Sheets cache

## 13) Partners Hub

- Сторінка: `src/app/partners/page.tsx`
- Джерело: статичний масив `PARTNER_CARDS` з `src/lib/partners`
- Актуальність: статична (код)

## 14) Partner: Klykov

- Сторінка: `src/app/partners/klykov/page.tsx`
- API:
  - `/api/partners/klykov/leads` (kanban leads з Amo)
  - `/api/marketing?channels=Klykov` (агреговані stats)
  - sidebar interactions:
    - `/api/partners/klykov/leads/[id]`
    - `/api/partners/klykov/leads/[id]/task`
    - `/api/partners/klykov/files/[id]`
- Джерела:
  - AmoCRM API v4 (live, через токени)
  - BigQuery маркетинг API для stats
- Актуальність:
  - Канбан: live Amo (майже realtime, залежить від валідного токена)
  - Stats: BigQuery-based

## 15) Partner: Facebook

- Сторінка: `src/app/partners/facebook/page.tsx`
- API:
  - `/api/partners/facebook/leads` (канбан, pipeline 8696950 + tag/filter Oman)
  - sidebar interactions:
    - `/api/partners/facebook/leads/[id]`
    - `/api/partners/facebook/leads/[id]/task`
    - `/api/partners/facebook/files/[id]`
- Джерела:
  - AmoCRM API v4 (live)
- Актуальність: live Amo (залежить від токенів)

## 16) Go bridge pages

- Сторінка: `src/app/go/[slug]/page.tsx`
- Що робить:
  - Логує клік у BQ таблицю `foryou_analytics.marketing_clicks_raw`
  - Створює lead в AmoCRM
  - Редіректить у WhatsApp
- Джерела: BigQuery + AmoCRM
- Актуальність: realtime event flow

## 17) Tracker endpoint (не UI сторінка, але частина data flow)

- API: `src/app/api/track/route.ts`
- Джерела/дії:
  - Читає/пише у BQ таблицю `marketing_visitor_mapping`
  - Дістає lead name з `leads_all_history_full`
  - Відправляє алерт у Telegram
- Примітка:
  - Тут зараз хардкод `BOT_TOKEN` і `CHAT_ID` у коді; краще винести у secrets/env

## PF: що робити, щоб дані були свіжі

Мінімальний процес оновлення PF:

1. Оновити PF raw leads:
  - `node scripts/kpi/sync_pf_final_fix.mjs`
2. Перебудувати phone matching view:
  - `node scripts/kpi/create_pf_master_view.mjs`
3. Згенерувати consolidated export:
  - `node scripts/pf_export_full_json.mjs`

Без цього PF буде показувати неактуальний snapshot.

## Корисні файли для підтримки

- Загальний маркетинг API: `src/app/api/marketing/route.ts`
- PF API:
  - `src/app/api/pf-listings/route.ts`
  - `src/app/api/pf-projects/route.ts`
- Sales API:
  - `src/app/api/sales/overview/route.ts`
  - `src/app/api/sales/directions/route.ts`
  - `src/app/api/sales/plan-fact/route.ts`
  - `src/app/api/sales/brokers/route.ts`
- Partner API:
  - `src/app/api/partners/klykov/**`
  - `src/app/api/partners/facebook/**`
- Sync workflows:
  - `.github/workflows/data-sync.yml`
  - `.github/workflows/deploy.yml`
