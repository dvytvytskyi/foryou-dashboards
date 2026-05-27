# Документація Деплою: Foryou Dashboards

Прод-деплой у цьому репозиторії виконується тільки через GitHub Actions. Ручний server-side deploy-скрипт більше не є частиною підтримуваного процесу.

## 1. Інформація про сервер
- IP адреса: `109.73.194.70`
- Користувач: `root`
- Домен: `https://foryou-admin.ru/`

## 2. Локації на сервері
- Основна директорія проекту: `/root/foryou-admin-ru/`
- Nginx конфіг: `/etc/nginx/sites-enabled/foryou-admin.ru`
- Nginx проксіює на контейнерний порт `3007`, який мапиться на `3000` всередині app-контейнера.

## 3. Єдиний сценарій деплою

Файли, runtime-конфіг і контейнерний опис зберігаються в репозиторії:

- GitHub workflow: `.github/workflows/deploy.yml`
- Compose-конфіг: `docker-compose.yml`
- Docker image: `Dockerfile`
- Список винятків для rsync: `.rsync-exclude`

Пайплайн працює так:

1. push у `main` або ручний запуск workflow
2. `rsync` синхронізує репозиторій у `/root/foryou-admin-ru/`
3. workflow оновлює `secrets/*.json` на сервері з GitHub Secrets
4. workflow генерує `.env` для контейнера
5. workflow запускає `docker compose` або fallback на `docker-compose`
6. контейнер `app` перебудовується і перевизначається через `up -d --force-recreate`

## 4. Необхідні GitHub Secrets

У репозиторії мають бути задані такі secrets:

- `SSH_PRIVATE_KEY`
- `GOOGLE_AUTH_JSON`
- `AMO_TOKENS_JSON`
- `AMO_CLIENT_ID`
- `AMO_CLIENT_SECRET`
- `AMO_DOMAIN`
- `AMO_REDIRECT_URI`
- `AUTH_SECRET`

## 5. Runtime-дані

Під час збірки в образ потрапляють потрібні дані з репозиторію:

- `pf_listings_report.json`
- `pf_projects_report.json`
- інші кореневі `*.json`, `*.csv`, `*.xlsx`
- директорія `data/`

Чутливі credentials не копіюються з локального workspace. Вони генеруються на сервері під час workflow run.

## 6. Нова BigQuery proxy-конфігурація

Цей репозиторій тепер підтримує роботу через проксі для BigQuery.

### На EU-сервері

- `BIGQUERY_PROXY_SECRET` — секрет для захисту проксі-запитів.
- `BIGQUERY_PROXY_URL` тут не встановлюється.
- `GOOGLE_APPLICATION_CREDENTIALS` або `GOOGLE_AUTH_JSON` має бути налаштовано як раніше.

### На RU-сервері

- `BIGQUERY_PROXY_URL=https://<EU_HOST>/api/bigquery-proxy`
- `BIGQUERY_PROXY_SECRET` має бути той самий, що й на EU-сервері.

### Додаткові опції

- `BIGQUERY_PROJECT_ID` — за замовчуванням `crypto-world-epta`, можна перевизначити.

При встановленні `BIGQUERY_PROXY_URL` всі BigQuery-запити з маркетингових API йтимуть через EU-проксі та виконуватимуться на сервері з доступом до Google BigQuery.

## 7. Ручна перевірка після деплою

На сервері:

```bash
cd /root/foryou-admin-ru
docker compose ps || docker-compose ps
docker compose logs --tail 100 app || docker-compose logs --tail 100 app
```

Перевірка health endpoint через контейнерний web port:

```bash
curl -I https://foryou-admin.ru/login
```

## 8. Типові проблеми

### Workflow падає на compose-команді
Причина: на сервері відсутній `docker compose` plugin або встановлено тільки `docker-compose`.

Що зроблено: workflow уже має fallback і пробує обидва варіанти.

### Деплой стартував, але сайт не піднявся
Причина: контейнер не пройшов healthcheck або впав на старті через env/runtime-помилку.

Перевірка:

```bash
cd /root/foryou-admin-ru
docker compose logs --tail 100 app || docker-compose logs --tail 100 app
```

### Помилка BigQuery 403 на бордах
Симптом: у UI видно `403 Forbidden` з BigQuery (`/bigquery/v2/projects/crypto-world-epta/queries`).

Перевірка на сервері:

```bash
cd /root/foryou-admin-ru

# 1) Який service account у ключі контейнера
docker compose exec -T app node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('/app/secrets/crypto-world-epta-2db29829d55d.json','utf8'));console.log(j.client_email);" \
	|| docker-compose exec -T app node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('/app/secrets/crypto-world-epta-2db29829d55d.json','utf8'));console.log(j.client_email);"

# 2) Чи має ключ право виконувати query
docker compose exec -T app node -e "const {BigQuery}=require('@google-cloud/bigquery');(async()=>{const bq=new BigQuery({projectId:'crypto-world-epta',keyFilename:'/app/secrets/crypto-world-epta-2db29829d55d.json'});try{const [r]=await bq.query({query:'SELECT 1 ok',useLegacySql:false});console.log('BQ_OK',r[0].ok);}catch(e){console.log('BQ_ERR',e.code||'',e.message);} })();" \
	|| docker-compose exec -T app node -e "const {BigQuery}=require('@google-cloud/bigquery');(async()=>{const bq=new BigQuery({projectId:'crypto-world-epta',keyFilename:'/app/secrets/crypto-world-epta-2db29829d55d.json'});try{const [r]=await bq.query({query:'SELECT 1 ok',useLegacySql:false});console.log('BQ_OK',r[0].ok);}catch(e){console.log('BQ_ERR',e.code||'',e.message);} })();"
```

Якщо `BQ_ERR 403`:

- Дати service account доступ у GCP проекті `crypto-world-epta`:
	- `roles/bigquery.jobUser`
	- `roles/bigquery.dataViewer` (мінімум на dataset `foryou_analytics`; можна на проект)
- Після оновлення IAM перезапустити app-контейнер:

```bash
cd /root/foryou-admin-ru
docker compose up -d --force-recreate app || docker-compose up -d --force-recreate app
```

### Порожні таблиці в Property Finder
Причина: у репозиторії або у зібраному образі застарілі `pf_listings_report.json` чи `pf_projects_report.json`.

Перевірка:

```bash
cd /root/foryou-admin-ru
ls -lh pf_listings_report.json pf_projects_report.json
```

### Проблеми з авторизацією після деплою
Причина: неконсистентний `AUTH_SECRET` між деплоями або порожнє значення secret.

Перевірка: підтвердити, що `AUTH_SECRET` заданий у GitHub Secrets і не змінювався випадково.

## 8. Що більше не використовуємо

- `scripts/deploy_to_server.sh` не виконує deploy і залишений лише як явний guardrail.
- Окремий ручний server-side deploy через `/root/amo-sync` вважається legacy-контуром і не є частиною prod-схеми.

## 9. Server cron для AMO/PF (кожні 5 хв)

Якщо AMO/PF інтеграції мають працювати саме на сервері (а не через GitHub schedule), встановити cron-job:

```bash
cd /root/foryou-admin-ru
chmod +x scripts/sync/install_amo_pf_fast_sync_cron.sh scripts/sync/amo_pf_fast_sync_cron_wrapper.sh
bash scripts/sync/install_amo_pf_fast_sync_cron.sh /root/foryou-admin-ru
crontab -l | grep amo_pf_fast_sync_cron_wrapper
```

Що запускається кожні 5 хв:

- `scripts/sync/sync_pf_to_amo.mjs`
- `scripts/kpi/sync_pf_amo_project_match.mjs`
- `scripts/kpi/sync_amo_channel_leads_raw.mjs`

Запуск виконується через `docker compose exec -T app ...` (fallback: `docker-compose`), тому окремі `node_modules` на хості не потрібні.

Логи:

- Загальний cron-лог: `/var/log/foryou-sync/cron.log`
- stdout скриптів: `/var/log/foryou-sync/amo_pf_fast_sync_stdout.log`
- аудит кроків: `/var/log/foryou-sync/amo_pf_fast_sync_audit.log`
