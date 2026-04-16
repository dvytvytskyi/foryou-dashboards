# GitHub Secrets Setup (PostgreSQL + PF)

Цей файл описує, куди додати секрети для нового workflow:
- `.github/workflows/postgres-sync.yml`

## 1) Де додавати

GitHub Repo -> Settings -> Secrets and variables -> Actions -> New repository secret

## 2) Обов'язкові secrets

### PostgreSQL

- `POSTGRES_URL` (рекомендовано)
  - формат: `postgresql://USER:PASSWORD@HOST:PORT/DB?sslmode=require`

АБО (якщо не використовуєте `POSTGRES_URL`) додайте всі нижче:
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_SSL_MODE` (`require` або `disable`)

### Property Finder API

- `PF_API_KEY`
- `PF_API_SECRET`

## 3) Що з твоїми поточними PF ключами

Ті значення, які ти надав, треба додати в repo secrets як:
- Name: `PF_API_KEY`
- Name: `PF_API_SECRET`

Не зберігати їх у коді або в markdown-файлах.

## 4) Які workflow їх використовують

- `.github/workflows/postgres-sync.yml`
  - `db:init`
  - `sync:pf:postgres`
  - `sync:sales:postgres`

## 5) Після додавання секретів

1. Запусти workflow вручну:
   - GitHub -> Actions -> PostgreSQL Near-Realtime Sync -> Run workflow
2. Перевір, що кроки пройшли без помилок.
3. Перевір таблиці в PostgreSQL:
   - `sync_runs`
   - `pf_listings_snapshot`
   - `pf_projects_snapshot`
   - `sales_deals_raw`

## 6) Якщо alert в Telegram не потрібен

Нічого додавати не треба.
Telegram secrets не використовуються в новому postgres-sync workflow.
