# Документація Деплою: Foryou Dashboards

Прод-деплой у цьому репозиторії виконується тільки через GitHub Actions. Ручний server-side deploy-скрипт більше не є частиною підтримуваного процесу.

## 1. Інформація про сервер
- IP адреса: `135.181.201.185`
- Користувач: `root`
- Домен: `https://dashboards.foryou-realestate.com/`

## 2. Локації на сервері
- Основна директорія проекту: `/root/foryou-dashboards-prod/`
- Nginx конфіг: `/etc/nginx/sites-enabled/dashboards.foryou-realestate.com`
- Nginx проксіює на контейнерний порт `3007`, який мапиться на `3000` всередині app-контейнера.

## 3. Єдиний сценарій деплою

Файли, runtime-конфіг і контейнерний опис зберігаються в репозиторії:

- GitHub workflow: `.github/workflows/deploy.yml`
- Compose-конфіг: `docker-compose.yml`
- Docker image: `Dockerfile`
- Список винятків для rsync: `.rsync-exclude`

Пайплайн працює так:

1. push у `main` або ручний запуск workflow
2. `rsync` синхронізує репозиторій у `/root/foryou-dashboards-prod/`
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

## 6. Ручна перевірка після деплою

На сервері:

```bash
cd /root/foryou-dashboards-prod
docker compose ps || docker-compose ps
docker compose logs --tail 100 app || docker-compose logs --tail 100 app
```

Перевірка health endpoint через контейнерний web port:

```bash
curl -I https://dashboards.foryou-realestate.com/login
```

## 7. Типові проблеми

### Workflow падає на compose-команді
Причина: на сервері відсутній `docker compose` plugin або встановлено тільки `docker-compose`.

Що зроблено: workflow уже має fallback і пробує обидва варіанти.

### Деплой стартував, але сайт не піднявся
Причина: контейнер не пройшов healthcheck або впав на старті через env/runtime-помилку.

Перевірка:

```bash
cd /root/foryou-dashboards-prod
docker compose logs --tail 100 app || docker-compose logs --tail 100 app
```

### Порожні таблиці в Property Finder
Причина: у репозиторії або у зібраному образі застарілі `pf_listings_report.json` чи `pf_projects_report.json`.

Перевірка:

```bash
cd /root/foryou-dashboards-prod
ls -lh pf_listings_report.json pf_projects_report.json
```

### Проблеми з авторизацією після деплою
Причина: неконсистентний `AUTH_SECRET` між деплоями або порожнє значення secret.

Перевірка: підтвердити, що `AUTH_SECRET` заданий у GitHub Secrets і не змінювався випадково.

## 8. Що більше не використовуємо

- `scripts/deploy_to_server.sh` не виконує deploy і залишений лише як явний guardrail.
- Окремий ручний server-side deploy через `/root/amo-sync` вважається legacy-контуром і не є частиною prod-схеми.
