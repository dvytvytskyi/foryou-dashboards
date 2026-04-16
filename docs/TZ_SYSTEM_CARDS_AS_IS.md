# ТЗ: Візуалізація поточної системи картками (AS-IS)

## 1. Мета

Потрібно візуалізувати поточну архітектуру системи ForYou Dashboards у вигляді карток і зв'язків між ними.

Ціль:
- прозоро побачити, які сторінки читають які API;
- які API читають які джерела (BigQuery / AmoCRM / JSON / Excel / Google Sheets);
- де є автооновлення, де ручне оновлення, де частота невідома;
- де є ризики застарівання даних.

Це саме AS-IS стан (як працює зараз), без бажаної майбутньої архітектури.

## 2. Формат візуалізації

Візуалізація має бути у форматі graph board з картками (nodes) і лінками (edges).

Обов'язкові типи карток:
- Page
- API
- Data Source
- Sync Job
- Workflow
- External Service

Обов'язкові типи зв'язків:
- calls (Page -> API)
- reads_from (API -> Data Source)
- writes_to (Sync Job -> Data Source)
- scheduled_by (Workflow -> Sync Job)
- uses (API/Job -> External Service)

## 3. Джерело істини для AS-IS

Для побудови використовувати актуальні файли проекту:
- `.github/workflows/data-sync.yml`
- `src/app/**/page.tsx`
- `src/app/api/**/route.ts`
- `scripts/sync/*.mjs`
- `scripts/pf_listings_report_auto.mjs`
- `scripts/kpi/generate_pf_projects_report.mjs`
- `docs/DATA_SOURCES_BY_PAGE.md`
- `docs/DATA_REFRESH_TABLE.md`

## 4. Обов'язкові картки (мінімальний набір)

## 4.1 Workflow картки
- Data Sync Workflow (`.github/workflows/data-sync.yml`)
- Deploy Workflow (`.github/workflows/deploy.yml`)

## 4.2 Sync Job картки
- sync_red_to_bq
- sync_klykov_to_bq
- sync_unified_leads
- pf_listings_report_auto (manual)
- generate_pf_projects_report (manual)
- sync_plan_fact_bq (present in repo, schedule not confirmed)
- sync_brokers_bq (present in repo, schedule not confirmed)

## 4.3 API картки (ключові)
- `/api/marketing`
- `/api/marketing/red-scoreboard`
- `/api/marketing/geo`
- `/api/marketing/facebook`
- `/api/marketing/facebook-scoreboard`
- `/api/pf-listings`
- `/api/pf-projects`
- `/api/sales/overview`
- `/api/sales/directions`
- `/api/sales/plan-fact`
- `/api/sales/brokers`
- `/api/partners/klykov/leads`
- `/api/partners/facebook/leads`

## 4.4 Page картки (ключові)
- `/marketing`
- `/red`
- `/facebook`
- `/property-finder`
- `/sales`
- `/sales/directions`
- `/sales/plan-fact`
- `/sales/brokers`
- `/partners/klykov`
- `/partners/facebook`

## 4.5 Data Source картки
- BQ: `foryou_analytics.marketing_channel_drilldown_daily`
- BQ: `foryou_analytics.marketing_v2_leads`
- BQ: `foryou_analytics.amo_channel_leads_raw`
- BQ: `foryou_analytics.marketing_geo_creative_hub`
- BQ: `foryou_analytics.plan_fact_crm_leads`
- BQ: `foryou_analytics.plan_fact_crm_tasks`
- JSON: `pf_listings_report.json`
- JSON: `pf_projects_report.json`
- Excel: `offplan.xlsx`
- Excel: `secondary_rental.xlsx`
- Excel: `support.xlsx`
- Cache: `data/cache/plan-fact/raw_leads.json`
- Cache: `data/cache/plan-data/*.json`

## 4.6 External Service картки
- AmoCRM API
- BigQuery
- Google Sheets API
- Property Finder API

## 5. Обов'язкові поля картки

Кожна картка повинна мати:
- `id` (унікальний, стабільний)
- `type` (`page|api|source|job|workflow|external`)
- `title`
- `owner` (наприклад: Marketing, Sales, Partners, Infra)
- `freshness_mode` (`realtime|scheduled|manual|unknown`)
- `refresh_frequency` (наприклад: `hourly`, `manual`, `unknown`)
- `criticality` (`high|medium|low`)
- `status` (`ok|warning|risk`)
- `notes` (коротко, 1-2 рядки)
- `file_ref` (шлях до ключового файлу)

## 6. Логіка статусів для AS-IS

Виставлення `status` і `freshness_mode`:

- `ok`:
  - джерело має scheduler і підтверджену частоту;
- `warning`:
  - дані оновлюються вручну, але скрипт є;
- `risk`:
  - частота невідома або не підтверджена у workflow;
  - або file-based джерело використовується в runtime без автоматичного оновлення.

Правила:
- PF JSON (`pf_listings_report.json`, `pf_projects_report.json`) = `warning` (manual).
- Excel runtime для Sales Overview/Directions = `risk`.
- `amo_channel_leads_raw` / `marketing_geo_creative_hub`, якщо scheduler не підтверджений у поточному workflow = `risk`.
- RED/Klykov drilldown через hourly workflow = `ok`.

## 7. Формат вхідних даних для рендеру (рекомендований)

```json
{
  "nodes": [
    {
      "id": "api_marketing",
      "type": "api",
      "title": "/api/marketing",
      "owner": "Marketing",
      "freshness_mode": "scheduled",
      "refresh_frequency": "hourly",
      "criticality": "high",
      "status": "ok",
      "notes": "Reads marketing_channel_drilldown_daily",
      "file_ref": "src/app/api/marketing/route.ts"
    }
  ],
  "edges": [
    {
      "from": "page_marketing",
      "to": "api_marketing",
      "type": "calls"
    }
  ]
}
```

## 8. Візуальні вимоги до карток

- Колір рамки за `status`:
  - `ok`: зелений
  - `warning`: жовтий
  - `risk`: червоний
- Іконка за `type`:
  - page: screen
  - api: brackets
  - source: database/file
  - job: cog
  - workflow: calendar/clock
  - external: cloud
- Показувати на картці мінімум:
  - title
  - type
  - refresh_frequency
  - status

## 9. Групування на полотні (layout)

Горизонтальні swimlanes:
- Lane 1: Pages
- Lane 2: API
- Lane 3: Data Sources
- Lane 4: Jobs/Workflows
- Lane 5: External Services

Порядок зв'язків зверху вниз:
Page -> API -> Source
Workflow -> Job -> Source
API/Job -> External Service

## 10. Що обов'язково має бути видно в результаті

- Що оновлюється щогодини (RED/Klykov/unified leads).
- Що manual (PF JSON).
- Що file-based runtime (Sales Excel).
- Де є unknown frequency.
- Які сторінки залежать від яких API та джерел.

## 11. Критерії приймання

Вважаємо задачу виконаною, якщо:
- є мінімум 1 граф з усіма обов'язковими типами карток;
- кожна ключова сторінка має зв'язок хоча б з 1 API;
- кожен ключовий API має зв'язок хоча б з 1 data source;
- для всіх ключових source заповнений `refresh_frequency` (`hourly|manual|unknown`);
- у графі чітко видно мінімум 3 зони ризику (PF JSON, Sales Excel, unknown BQ tables);
- є можливість експорту у JSON (nodes/edges).

## 12. Out of Scope (для цього етапу)

- Проектування TO-BE архітектури.
- Міграція джерел даних.
- Додавання нових ETL процесів.
- Переробка API.

## 13. Наступний крок (після цього ТЗ)

Після побудови AS-IS карти робимо окреме TO-BE ТЗ:
- як прибрати file-based джерела з runtime;
- як уніфікувати freshness;
- які таблиці залишити в BigQuery, що перенести в operational DB (PostgreSQL);
- який pipeline/monitoring потрібен.
