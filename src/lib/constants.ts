import {
    Database,
    Cpu,
    BarChart3,
    Layout,
    Table as TableIcon,
    ClipboardCheck,
    TrendingUp,
    Layers
} from "lucide-react";

export const reportSections = [
    {
        id: "block-a",
        title: "Отдел Продаж",
        tag: "Operational",
        description: "Комплексная аналитика работы департамента продаж на базе Real Estate Pipeline (ID: 8696950), ориентированная на контроль KPI и эффективность брокеров.",
        sources: [
            {
                name: "AmoCRM / API Integration",
                type: "Primary Source",
                details: "Синхронизация воронки 8696950. Отслеживание пути клиента от лида до финального статуса 'Оплачено' (ID: 142).",
                specs: ["Main Pipeline: 8696950", "Lead ID: System Field"]
            },
            {
                name: "Digital Tracking (Ads)",
                type: "Marketing Data",
                details: "Глубокая сквозная аналитика до уровня креативов (utm_content) и ключевых слов (utm_term).",
                specs: ["Geo: Campaign Prefix", "Ads: utm_content"]
            }
        ],
        tasks: [
            { title: "Эффективность Креативов", goal: "Анализ ROMI каждого рекламного ролика или баннера на основе реальных оплат, а не кликов.", badge: "Marketing+" },
            { title: "Лидерборд Брокеров", goal: "Рейтинг на основе поля 'Стоимость юнита' (ID: 1343899) и 'Комиссия брокера %'.", badge: "Performance" },
            { title: "Типология Портфеля", goal: "Разделение через поле ID: 703143 (Off-plan / Вторичка). Оценка фокуса команды.", badge: "Segments" },
            { title: "Гео-анализ (ROI по странам)", goal: "Сравнение стоимости лида и конверсии в разных локациях (Испания, ОАЕ и др.).", badge: "Geo" },
            { title: "Средние Чеки (ID: 1343899)", goal: "Калькуляция средних показателей для оценки качества работы с сегментами.", badge: "Quality" },
            { title: "План / Факт (KPI)", goal: "Контроль выполнения личных планов продаж в реальном времени.", badge: "Management" }
        ],
        requirements: [
            {
                item: "AmoCRM Real Fields",
                desc: ["Стоимость юнита (ID: 1343899)", "Брокер (ID: 1343903) — ТРЕБУЕТ КОРРЕКЦИИ", "Источник (ID: 703131)", "Дата закрытия (Status ID: 142)"],
                context: "Live Sync Data"
            },
            {
                item: "Креативный Трекинг",
                desc: ["utm_content: ID объявления", "utm_term: ключевое слово/ЦА", "utm_campaign: Гео-префикс (es_, ua_)"],
                context: "Анализ гибкости"
            },
            {
                item: "Типология (ID: 703143)",
                desc: ["Off-plan (Option ID: 695201)", "Вторичка (Option ID: 695203)"],
                context: "Сегментация"
            }
        ],
        visualizations: [
            { type: "chart", name: "ROI Креативов", desc: "Сравнение доходности объявлений", icon: TrendingUp },
            { type: "table", name: "Broker Performance", desc: "Рейтинг по суммарной комиссии", icon: TableIcon },
            { type: "chart", name: "Geo Heatmap", desc: "Доходность в разрезе стран (префиксы)", icon: TrendingUp },
            { type: "chart", name: "Portfolio Mix", desc: "Off-plan vs Secondary", icon: TrendingUp }
        ]
    },
    {
        id: "block-b",
        title: "Вся Компания",
        tag: "Strategic",
        description: "Верхнеуровневый дашборд для руководства, объединяющий все бизнес-юниты, партнерские сети и глобальную географию продаж.",
        sources: [
            {
                name: "Global Data Pool",
                type: "Aggregated Warehouse",
                details: "Сводное хранилище (BigQuery), объединяющее данные по всем странам и рекламным кабинетам (Ads + Amo).",
                specs: ["Warehouse: BigQuery", "Update: Daily Sync"]
            }
        ],
        tasks: [
            { title: "Глобальные итоги", goal: "Динамика ключевых показателей компании по всем регионам присутствия.", badge: "Global" },
            { title: "Гео-экспансия", goal: "Мониторинг окупаемости новых рынков на основе префиксов кампаний.", badge: "Expansion" },
            { title: "Разбивка по Юнитам", goal: "Анализ вклада: СВ, Партнерка (ID: 703153), Отдел продаж.", badge: "Units" },
            { title: "Эффективность Партнеров", goal: "Рейтинг партнеров (ID: 695223) на основе чистого дохода компании.", badge: "Partners" }
        ],
        requirements: [
            {
                item: "Global Mapping",
                desc: ["Маркировка сделок: СВ / Партнерка / ОП", "ID ответственного за сопровождение", "Валютный контроль (конвертация в AED/USD)"],
                context: "Сведение баланса"
            },
            {
                item: "Country Mapping",
                desc: ["Привязка utm_campaign к конкретному ГЕО", "Локальный учет налогов и лицензий застройщиков"],
                context: "Гео-аналитика"
            }
        ],
        visualizations: [
            { type: "chart", name: "Global Dynamics", desc: "Revenue by Region", icon: TrendingUp },
            { type: "chart", name: "Unit Efficiency", desc: "Compare Sales vs Partners", icon: TrendingUp },
            { type: "table", name: "Partner List", desc: "Total Income per Partner", icon: TableIcon }
        ]
    },
    {
        id: "block-c",
        title: "Расходы",
        tag: "Financial",
        description: "Управление прибыльностью через детализацию всех статей затрат, включая маркетинг (Property Finder) и операционку.",
        sources: [
            {
                name: "Маркетинговые API",
                type: "Marketing Spend",
                details: "Интеграция с Property Finder API и FB Ads для получения точных сумм затрат на каждый лид.",
                specs: ["Spend API: PF, FB, Google", "OpEx: Google Sheets"]
            }
        ],
        tasks: [
            { title: "P&L Анализ", goal: "Revenue (AmoCRM) минус Expenses (Marketing + OpEx). Чистая прибыль.", badge: "Profitability" },
            { title: "Cost per Asset", goal: "Сколько мы тратим на продвижение конкретного объекта недвижимости (Юнита).", badge: "Marketing-IQ" },
            { title: "Burn Rate", goal: "Среднемесячный расход на содержание офисов и аднимистрации.", badge: "Survival" }
        ],
        requirements: [
            {
                item: "Expense Logs",
                desc: ["Marketing Spend (PF/Ads/ManyChat)", "Operational Costs (Staff, Rent)", "Broker Commissions (AmoID: 1343909)"],
                context: "P&L База"
            }
        ],
        visualizations: [
            { type: "chart", name: "Profitability Curve", desc: "Monthly Revenue vs Cost", icon: TrendingUp },
            { type: "chart", name: "Spend Breakdown", desc: "Marketing vs Admin Costs", icon: TrendingUp }
        ]
    },
    {
        id: "block-d",
        title: "Инвойсы",
        tag: "Forecast",
        description: "Прогнозирование Cashflow на базе Pipeline Бухгалтерия (ID: 10633834) и ожидаемых выплат от застройщиков.",
        sources: [
            {
                name: "Accounting Pipeline",
                type: "AmoCRM Workflow",
                details: "Мониторинг статусов оплаты в воронке 10633834. Этап 'Инвойс выставлен' (ID: 83955706).",
                specs: ["Pipeline: 10633834", "Status: 83955706"]
            }
        ],
        tasks: [
            { title: "Cashflow Forecast", goal: "Прогноз поступлений на 1-3 месяца на основе 'Ожидаемой даты оплаты'.", badge: "Liquidity" },
            { title: "Задолженность ЖК", goal: "Контроль невыплаченных комиссий со стороны застройщиков.", badge: "Control" },
            { title: "Broker Payouts", goal: "Мониторинг сумм к выплате брокерам (Поле ID: 1343909).", badge: "Liabilities" }
        ],
        requirements: [
            {
                item: "Invoice Mastery",
                desc: ["Статус инвойса (ID: 83955706)", "Сумма комиссии брокера (ID: 1343909)", "Комиссия застройщика % (ID: 1343901)"],
                context: "Forecast Base"
            }
        ],
        visualizations: [
            { type: "chart", name: "12-Week Cashflow", desc: "Incoming vs Liability", icon: TrendingUp },
            { type: "stats", name: "Pending Revenue", desc: "Unpaid Invoices Sum", icon: Layers }
        ]
    }
];
