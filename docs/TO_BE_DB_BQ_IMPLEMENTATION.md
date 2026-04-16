# TO-BE Implementation: PostgreSQL + BigQuery (Near Real-Time)

Дата: 2026-04-16

## 1. Цільова модель

- PostgreSQL = operational layer (актуальний стан, realtime API).
- BigQuery = analytics layer (історія, heavy SQL, фінальні витрини для дашбордів).
- ETL/ELT:
  - CRM/PF/Sheets -> PostgreSQL (1-2 хв lag)
  - PostgreSQL -> BigQuery (5 хв lag)
- Runtime API не читає JSON/Excel як source of truth.

## 2. Що робимо в першу чергу (Phase 1)

1. Додаємо контроль свіжості даних:
   - endpoint: `/api/developer/freshness`
   - централізований список джерел у `src/lib/freshnessConfig.ts`
2. Вводимо стандарт статусів свіжості:
   - `ok`, `warning`, `risk`, `unknown`
3. Фіксуємо реальні SLA:
   - Marketing/RED/Klykov: 60 хв max
   - PF: 10 хв target
   - Sales Overview/Directions: 10-15 хв target

## 3. Міграція джерел (Phase 2-3)

## 3.1 PF (замість JSON)

Поточний стан:
- `pf_listings_report.json`, `pf_projects_report.json` (manual + deploy).

TO-BE:
- створити таблиці у PostgreSQL:
  - `pf_listings_snapshot`
  - `pf_projects_snapshot`
- sync job кожні 10 хв з Property Finder API
- API `/api/pf-listings` і `/api/pf-projects` читають з PG + BQ-enrichment

## 3.2 Sales Overview / Directions (замість runtime Excel)

Поточний стан:
- читання `offplan.xlsx`, `secondary_rental.xlsx`, `support.xlsx` у runtime.

TO-BE:
- ETL з джерела таблиць у PostgreSQL staging:
  - `sales_offplan_deals`
  - `sales_secondary_deals`
  - `sales_support_deals`
- API читають з PG view/materialized view
- Excel залишаємо тільки як backup/manual import

## 3.3 Plan/Fact

Поточний стан:
- BQ таблиці є, scheduler не підтверджений.

TO-BE:
- підключити `sync_plan_fact_bq.mjs` у scheduler
- підключити `sync_brokers_bq.mjs` після `sync_plan_fact_bq`
- додати контроль run-status у `sync_runs`

## 4. Scheduler target

- Every 5 min:
  - CRM incremental sync -> PostgreSQL
  - PF sync -> PostgreSQL
- Every 5 min + offset:
  - PostgreSQL -> BigQuery curated tables
- Every hour:
  - full backfill checks / reconciliation

## 5. Що потрібно від тебе для запуску прод-впровадження

## 5.1 Інфраструктура
- PostgreSQL instance (host, db, user, password, ssl mode).
- Де буде крутитися scheduler/worker:
  - або GitHub Actions
  - або Cloud Run + Cloud Scheduler
  - або окремий VPS worker

## 5.2 Секрети (нові)
- `POSTGRES_URL`
- `POSTGRES_SCHEMA` (optional)
- `PF_API_KEY`
- `PF_API_SECRET`
- `TELEGRAM_BOT_TOKEN` (винести з коду)
- `TELEGRAM_CHAT_ID` (винести з коду)

## 5.3 Правила даних
- Підтвердити офіційні SLA по кожній сторінці.
- Підтвердити canonical definition для `won/ql/meeting` по всіх API.

## 6. Критерії готовності

- PF не залежить від JSON у runtime.
- Sales Overview/Directions не залежать від Excel у runtime.
- Кожне джерело має last_sync_at і status.
- На `/developer` видно freshness для всіх критичних source.
- Dashboard lag прозоро вимірюється і алертиться.

## 7. Ризики і як зняти

- Ризик: різні definitions метрик у різних API.
  - Дія: винести status mapping у єдиний config/table.
- Ризик: silent fail sync job.
  - Дія: `sync_runs` + alerts + retry policy.
- Ризик: ручні процеси залишаться тіньовими.
  - Дія: block runtime fallback після стабілізації 2 тижні.
