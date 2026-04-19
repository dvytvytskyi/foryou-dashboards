# Документація: Consolidated Property Finder Export

## Опис задачі

Скрипт формує consolidated JSON-експорт Property Finder з деталізацією по лістингах, проєктах, бюджетах, лідах і dual KPI (confirmed vs modeled). Дані беруться з API Property Finder (Atlas API) та зберігаються у `data/exports/pf_full_export_latest.json`.

---

## Джерела даних

- **API Property Finder (Atlas):**
  - /listings — отримання лістингів (оголошень)
  - /credits/transactions — отримання транзакцій по витратах (credits)
  - /leads — отримання кількості лідів по лістингу

---

## Основні файли

- **scripts/pf_export_full_json.mjs** — основний скрипт для збору та обробки даних
- **data/exports/pf_full_export_latest.json** — фінальний експорт

---

## Як працює скрипт

1. **Отримання токена:**
   - Використовується API-ключ та секрет для отримання accessToken через /auth/token.

2. **Збір лістингів:**
   - Для кожної категорії (Sell, Rent, Commercial Sell, Commercial Rent) та для кожного стану (live, archived, unpublished, takendown) отримуються всі лістинги через /listings.

3. **Збір транзакцій:**
   - Через /credits/transactions отримуються всі транзакції типу "charge" та "credits".
   - Транзакції групуються по полю reference (listingInfo.reference).
   - Для кожного reference рахується:
     - Загальна сума витрат (Budget)
     - Деталізація по місяцях (BudgetByMonth, формат YYYY-MM)

4. **Збір лідів:**
   - Для кожного лістингу через /leads?listingId=... отримується кількість лідів.

5. **Формування звіту:**
   - Для кожного лістингу у звіт додається:
     - Категорія (Category)
     - Reference (унікальний ідентифікатор лістингу)
     - Title (назва)
     - CreatedAt (дата створення)
     - Budget (загальні витрати)
     - BudgetByMonth (деталізація по місяцях)
     - Leads (кількість лідів)

---

## Формат експорту

```json
[
  {
    "Category": "Sell",
    "Reference": "00000495",
    "Title": "VACANT | PARK VIEW | FULLY FURNISHED",
    "CreatedAt": "2026-03-18T11:32:02.223188514Z",
    "Budget": 3,
    "BudgetByMonth": {
      "2026-03": 3
    },
    "Leads": 2
  },
  ...
]
```

---

## Важливі нюанси

- **Мапінг транзакцій до лістингів** відбувається по полю reference (listingInfo.reference у транзакціях та reference у лістингах). Якщо reference у лістингу не збігається з reference у транзакції — бюджет буде 0.
- **Деталізація по місяцях** дозволяє аналізувати витрати у динаміці.
- **Скрипт використовує async/await** та працює з Node.js (ESM).

---

## Як запустити

1. Встановити залежності (якщо потрібно):
   ```sh
   npm install node-fetch
   ```
2. Запустити скрипт:
   ```sh
   node scripts/pf_export_full_json.mjs
   ```
3. Результат буде у `data/exports/pf_full_export_latest.json`

---

## Для чого це потрібно

- Аналізувати ефективність витрат по кожному лістингу
- Відслідковувати динаміку витрат по місяцях
- Звіряти кількість лідів та бюджет

---

## Контакти для питань

- Відповідальний: [ім'я/контакт]
- Репозиторій: foryou-dashboards
