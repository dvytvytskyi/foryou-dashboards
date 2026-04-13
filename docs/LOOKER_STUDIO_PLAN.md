# 📊 Looker Studio Implementation Plan: For You Real Estate

Цей документ є технічним чеклистом для реалізації дашбордів у Looker Studio на основі прототипу [prototype.foryou-realestate.com](https://prototype.foryou-realestate.com/sales-dashboard) та Google Таблиць.

---

## 🚀 НОВА СТРУКТУРА: Відділ продажів (Sales V2)
*Актуальний пріоритет згідно з новими вимогами.*

| Блок | Показник (KPI) | Статус | Технічна логіка |
| :--- | :--- | :--- | :--- |
| **V2.1** | **Общие цифры (Lead Audit & SLA)** | 🟡 IN PROG | `Total Leads, Lost/Unrealized Count. SLA (Response Time). Rule of 6 touches. Refusal Reasons. Call Duration (>30s) audit.` |
| **V2.2** | **Детали по направлениям** | ⬜ TODO | `Breakdown by Off-plan, Rent, Secondary. Sum(Price), Count(Deals)` |
| **V2.3** | **План/Факт (Командный)** | ⬜ TODO | `Dept Target vs Actual % + Global Broker Target vs Actual %` |
| **V2.4** | **Брокер в деталях** | ⬜ TODO | `Individual Funnel, Net Income, Touches (Compliance)` |
| **V2.5** | **Детали по лидам (ROI)** | ⬜ TODO | `Source List, Revenue per Source, Spendings (Sheet: Marketing_Costs), ROI` |

---


## 🟢 БЛОК 1: Отдел продаж (Operational)
*KPI та ефективність брокерів на базі Sales Pipeline.*

| ID | Показник | Статус | Технічна логіка | Джерело |
| :--- | :--- | :--- | :--- | :--- |
| **1.1** | **[record_count]** | ✅ DONE | `COUNT_DISTINCT(ID Сделки)` | Реестр |
| **1.2-1.4**| **[financial_kpis]** | ✅ DONE | `SUM(Metric) WHERE Status = 'Closed'` | Первичка / Вторичка |
| **1.5** | **[broker_ranking]** | ✅ DONE | `Group by Broker. Sort: net_income DESC` | Реестр |
| **1.6** | **[deal_segmentation]**| ✅ DONE | `Group by Тип Сделки (Pie Chart)` | Первичка / Вторичка |
| **1.7.a** | **[avg_perf_global]** | ✅ DONE | `AVG(Price), AVG(Margin %)` | Calculated Metrics |
| **1.7.b** | **[avg_perf_broker]** | ✅ DONE | `Scatter Plot (Price vs Margin %)` | Calculated Metrics |
| **1.8.a** | **[lead_auton_global]**| ✅ DONE | `Donut Chart: Company vs Own Leads` | Реестр |
| **1.8.b** | **[lead_auton_broker]**| ✅ DONE | `Stacked Bar: Company vs Own per Broker`| Реестр |
| **1.9** | **[kpi_target_match]** | ✅ DONE | `Data Blend: Registry + Targets` | Blend (Targets) |
| **1.10** | **[rule_6_touches_G]** | ✅ DONE | `Join: CRM ID + Tasks (Call). Count >= 6` | Sheet: Touches_Log |
| **1.11** | **[rule_6_touches_B]** | ✅ DONE | `Breakdown by Responsible User (6+ Count)` | Sheet: Touches_Log |
| **1.12** | **[hist_funnel_milest]**| ✅ DONE | `Sequence Vis: To Status + Unique Lead Count` | Funnel_History |

---

## 🔵 БЛОК 2: Угоди компанії (Global Dashboard)
*Аналітика по всій компанії: ОП, CB, Партнери та Сопровождение.*

| ID | Показник | Статус | Технічна логіка | Джерело |
| :--- | :--- | :--- | :--- | :--- |
| **2.1** | Кількість угод (6 джерел) | ✅ DONE | `Record Count (Full Merge: All 6 Sheets)` | Global_Master_Feed |
| **2.2-2.4**| Глобальні гроші (План/Факт) | ✅ DONE | `SUM (Price & Income) from All Channels` | Global_Master_Feed |
| **2.5** | **[company_mix]** | ✅ DONE | `Breakdown by Transaction Type (Donut Chart)` | Global_Master_Feed |
| **2.6** | **[dept_share]** | ✅ DONE | `Group by Dept (ОП, Партнери, CB)` | Global_Master_Feed |
| **2.7** | Деталізація супроводу (Таблиця) | ✅ DONE | `Filter: 'Support'. Count & Income` | Global_Master_Feed |
| **2.8** | Рейтинг брокерів та партнерів | ✅ DONE | `Group by Partner/Referral. Sort: Income` | Global_Master_Feed |
| **2.9** | **[hist_conversion]** | ✅ DONE | `Consolidated Historical Funnel` | BigQuery (AmoCRM Events) |
| **2.10** | **[top_deals_hall]** | ✅ DONE | `SORT DESC by Income LIMIT 3` | Registry |

---

## 🔴 БЛОК 3: Расходы (Financial Control)
*Аналіз витрат та розрахунок реального Net Profit.*

| ID | Показник | Статус | Технічна логіка | Джерело |
| :--- | :--- | :--- | :--- | :--- |
| **3.1** | **Total Expenses** | ✅ DONE | `SUM(Сумма) + Average Line` | Sheet: Global_Expense_Feed |
| **3.2** | **Net Profit / ROI** | ✅ DONE | `Formula: Revenue - Expenses` | Mix: CRM + ManyChat |
| **3.3** | **Net Profit (P&L)** | ✅ DONE | `Pre-aggregated Monthly P&L Table` | Global_PNL_Final |
| **3.4** | **Unit Economics** | ✅ DONE | `Total_Expenses / COUNT(Active_Brokers)` | Global_PNL_Final |

---

## 🟣 БЛОК 4: Инвойсы (Cashflow Forecast)
*Прогнозування надходжень на 1-3 місяці.*

| ID | Показник | Статус | Технічна логіка | Джерело |
| :--- | :--- | :--- | :--- | :--- |
| **4.1** | **Invoice Issued** | ✅ DONE | `Filter: [Status] = 'Short-term (~1 month)'` | Global_Invoices_Feed |
| **4.2** | **Invoice Pending** | ✅ DONE | `Filter: [Status] = 'Long-term (~3 months)'` | Global_Invoices_Feed |
| **4.3** | **Collection List** | ✅ DONE | `Group by Broker. Sort: Company_Income` | Global_Invoices_Feed |

---

> [!TIP]
> **Примітка щодо даних**: Блоки 1.1-1.6 вже візуально підтверджені на вашому скріншоті. Наступним пріоритетним кроком є налаштування **Data Blending** для Блоку 3, щоб бачити реальний прибуток компанії після вирахування витрат.
