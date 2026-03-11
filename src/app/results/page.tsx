"use client";

import React from "react";
import { motion } from "framer-motion";
import {
    LineChart,
    BarChart4,
    PieChart,
    Table as TableIcon,
    CheckCircle2,
    ArrowRight,
    Target,
    TrendingUp,
    DollarSign,
    Users,
    LayoutDashboard,
    Zap,
    ChevronRight,
    ShieldCheck
} from "lucide-react";

const deliverables = [
    {
        category: "Marketing & Lead Intelligence",
        icon: Target,
        color: "bg-blue-50 text-blue-600",
        results: [
            {
                title: "ROMI Креативов (Deep Analysis)",
                type: "Bar Chart + Table",
                description: "Финальная таблица эффективности каждого рекламного ролика/баннера.",
                outputs: [
                    "Точный Spend из Google/FB API",
                    "Количество качественных лидов (SQL) из AmoCRM",
                    "Сумма реальных оплат по конкретному объявлению",
                    "ROMI (Return on Marketing Investment) в %"
                ],
                why: "Выключаем то, что дает дешевые лиды, но нулевые продажи. Масштабируем прибыльные креативы."
            },
            {
                title: "Geo-Performance Matrix",
                type: "Heatmap / Geo-Chart",
                description: "Анализ прибыльности рынков (Испания, ОАЭ, Украина и т.д.) через utm_campaign.",
                outputs: [
                    "CPL (Cost per Lead) в разрезе стран",
                    "Конверсия из Лида в Сделку по каждому ГЕО",
                    "Средний чек по локации",
                    "Доля рынка в общем доходе"
                ],
                why: "Понимание, куда выгоднее инвестировать бюджет в следующем месяце."
            }
        ]
    },
    {
        category: "Sales Team Performance",
        icon: Users,
        color: "bg-emerald-50 text-emerald-600",
        results: [
            {
                title: "Broker Leaderboard (Real Profit)",
                type: "Interactive Leaderboard",
                description: "Рейтинг брокеров не по 'активности', а по реальным деньгам в кассе.",
                outputs: [
                    "Sum of Units Sold (ID: 1343899)",
                    "Total Agency Commission earned",
                    "Conversion Rate: Lead to Paid Deal",
                    "Average Sales Cycle (дни от лида до оплаты)"
                ],
                why: "Объективная система бонусов и выявление топ-перформеров компании."
            },
            {
                title: "Funnel Velocity Report",
                type: "Funnel Chart",
                description: "Детальный отчет по 'узким местам' в воронке Real Estate.",
                outputs: [
                    "Drop-off rate на каждом этапе",
                    "Time-in-stage (где сделки 'зависают' дольше всего)",
                    "Причины отказов (Loss Reasons) в динамике"
                ],
                why: "Оптимизация работы отдела продаж: где мы теряем деньги каждый день."
            }
        ]
    },
    {
        category: "Financial Control & Forecast",
        icon: DollarSign,
        color: "bg-amber-50 text-amber-600",
        results: [
            {
                title: "12-Week Cashflow Forecast",
                type: "Area Chart / Pulse Chart",
                description: "Прогноз поступления денежных средств на базе бухгалтерской воронки (ID: 10633834).",
                outputs: [
                    "Ожидаемые выплаты от застройщиков по датам",
                    "График выплат комиссий брокерам (Liabilities)",
                    "Net Cashflow (что останется в компании)",
                    "Gap Analysis (вероятность кассовых разрывов)"
                ],
                why: "Финансовая безопасность: знаем точный баланс на 3 месяца вперед."
            },
            {
                title: "P&L Dashboard (Global)",
                type: "Summary Table",
                description: "Главная таблица прибылей и убытков компании в реальном времени.",
                outputs: [
                    "Gross Revenue (Выручка)",
                    "Marketing Spend (Property Finder + Ads)",
                    "OpEx (Зарплаты, Офис, Софт)",
                    "EBITDA и Чистая прибыль %"
                ],
                why: "Видим реальную маржинальность бизнеса после всех расходов."
            }
        ]
    }
];

export default function ResultsPage() {
    return (
        <div className="">
            <div className="">
                <header className="mb-24">
                    <div className="inline-block px-3 py-1 bg-zinc-900 text-white rounded text-[9px] font-black uppercase tracking-widest mb-6">
                        Final Outcome
                    </div>
                    <h1 className="text-6xl font-black text-zinc-900 tracking-tighter mb-8 leading-[0.9]">
                        ФИНАЛЬНЫЙ<br />РЕЗУЛЬТАТ
                    </h1>
                    <p className="text-xl text-zinc-500 leading-relaxed font-medium max-w-2xl border-l-2 border-zinc-100 pl-8">
                        Это детальное описание того, что вы получите в Looker Studio после завершения всех этапов интеграции. Никаких догадок — только чистые данные для управления бизнесом.
                    </p>
                </header>

                <div className="space-y-32">
                    {deliverables.map((section, idx) => (
                        <section key={idx} className="relative">
                            <div className="flex items-center gap-6 mb-12">
                                <div className={`w-14 h-14 ${section.color} rounded-2xl flex items-center justify-center`}>
                                    <section.icon className="w-7 h-7" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Категория результатов</span>
                                    <h2 className="text-3xl font-black text-zinc-900 tracking-tight uppercase">{section.category}</h2>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-12">
                                {section.results.map((res, rIdx) => (
                                    <motion.div
                                        key={rIdx}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        className="bg-white border border-zinc-100 rounded-3xl p-10 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative"
                                    >
                                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                            {res.title.includes("Chart") || res.type.includes("Chart") ? <LineChart size={120} /> : <TableIcon size={120} />}
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
                                            <div>
                                                <div className="flex items-center gap-3 mb-4">
                                                    <span className="px-3 py-1 bg-zinc-900 text-white text-[9px] font-black uppercase rounded tracking-widest">
                                                        {res.type}
                                                    </span>
                                                </div>
                                                <h3 className="text-2xl font-bold text-zinc-900 mb-4">{res.title}</h3>
                                                <p className="text-zinc-500 font-medium leading-relaxed mb-8">
                                                    {res.description}
                                                </p>

                                                <div className="bg-zinc-50/50 rounded-2xl p-6 border border-zinc-100">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <Zap className="w-4 h-4 text-zinc-900" />
                                                        <span className="text-xs font-bold uppercase tracking-widest">Бизнес-ценность:</span>
                                                    </div>
                                                    <p className="text-sm text-zinc-700 font-medium leading-relaxed italic">
                                                        "{res.why}"
                                                    </p>
                                                </div>
                                            </div>

                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block mb-6">Что внутри (Output Metrics):</span>
                                                <div className="space-y-4">
                                                    {res.outputs.map((out, oIdx) => (
                                                        <div key={oIdx} className="flex items-start gap-4 group/item">
                                                            <div className="mt-1 flex-none w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center group-hover/item:bg-emerald-500 transition-colors">
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-500 group-hover/item:text-white" />
                                                            </div>
                                                            <span className="text-[15px] font-semibold text-zinc-600 transition-colors group-hover/item:text-zinc-900">
                                                                {out}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                <footer className="mt-48 pt-12 border-t border-zinc-100 flex justify-between items-center text-zinc-400">
                    <div className="text-[10px] font-black uppercase tracking-[0.4em]">Architecture Unified v5.4</div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em]">Dubai Marketing Hub 2024</div>
                </footer>
            </div>
        </div>
    );
}
