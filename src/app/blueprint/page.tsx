"use client";

import React from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Database,
    Brain,
    Layout,
    Link2,
    Fingerprint,
    Target,
    Activity,
    Globe,
    MessageSquare,
    Smartphone,
    PhoneCall,
    Youtube,
    Search,
    Zap,
    ShieldCheck
} from "lucide-react";

const systemMap = {
    sources: [
        {
            group: "CRM & Core",
            items: [
                { name: "AMO CRM", tech: "API / Webhooks", details: "Сделки, ФИО брокеров, статусы инвойсов. Логика SLA (время ответа), запись звонков, история 6 касаний до сделки." },
                { name: "Finance Tables", tech: "Google Sheets / Excel", details: "ЗП, аренда офиса, налоги, выплаты партнерам, операционные расходы." }
            ]
        },
        {
            group: "Marketing & LeadGen",
            items: [
                { name: "Property Finder", tech: "REST API", details: "Прямая интеграция лидов и статистики просмотров объявлений." },
                { name: "Google / FB Ads", tech: "Conversion API", details: "Сквозная аналитика: от клика до прибыли. Гибкость по кампаниям и креативам." },
                { name: "Red (Lead Pay)", tech: "Manual / Sheet Sync", details: "Плата за квалифицированные лиды по условиям (работа через промежуточный шит)." }
            ]
        },
        {
            group: "Social & Automation",
            items: [
                { name: "WhatsApp & ManyChat", tech: "UTM Bridge", details: "Лиды из инсты/ватсапа. Прокладка UTM через сайт для сохранения истории касаний. Автоответы ManyChat." },
                { name: "Telegram Bot / YouTube", tech: "DeepLinks / Cookies", details: "Заложини в описании + куки для отслеживания перехода из видео-контента." },
                { name: "SEO AI & Site", tech: "Raw Data tracking", details: "Два разных источника. Максимум raw data для анализа поведения и оповещений при повторном визите." }
            ]
        }
    ],
    logicBrain: [
        { title: "Расчет динамики", desc: "Автоматическое сравнение периодов MoM (месяц к месяцу), QoQ (квартал), YoY (год)." },
        { title: "Склейка данных", desc: "Привязка рекламного расхода (Ads/PF) к конкретному доходу из CRM на основе UTM-меток." },
        { title: "Ранжирование", desc: "Сложная логика рейтинга брокеров (вес сделки, конверсия, соблюдение SLA)." },
        { title: "Умная Фильтрация", desc: "Разделение потоков: Off-plan, Вторичка, Аренда, Ипотека, ID + Golden Visa, Открытие бизнеса." },
        { title: "Lead Intelligence", desc: "Если клиент из CRM заходит на сайт — система присылает оповещение брокеру." },
        { title: "Гео-анализ", desc: "Определение реального гео по номеру телефона + фактическое гео из формы заявки." }
    ],
    blocks: [
        { id: "A", title: "ОТДЕЛ ПРОДАЖ", type: "Operational", focus: "Статистика брокеров, SLA, 6 касаний, конверсии по воронкам." },
        { id: "B", title: "ВСЯ КОМПАНИЯ", type: "Strategic", focus: "P&L юнитов, доля СВ и партнерки, общая маржинальность." },
        { id: "C", title: "РАСХОДЫ", type: "Financial", focus: "Детализация затрат, Burn Rate, окупаемость рекламных каналов." },
        { id: "D", title: "ИНВОЙСЫ", type: "Forward-looking", focus: "Прогноз Cashflow на 1 и 3 месяца, контроль кассовых разрывов." }
    ]
};

export default function MasterBlueprintPage() {
    return (
        <div className="">
            <div className="">

                {/* Header Section */}
                <header className="mb-24 border-b border-zinc-100 pb-16">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-12">
                        <div className="max-w-3xl">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-zinc-900 rounded-2xl flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5 text-white" />
                                </div>
                                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">Master Blueprint v2.0</h2>
                            </div>
                            <h1 className="text-6xl font-black tracking-tight text-zinc-900 mb-8 leading-[0.9]">Единая Картина <br /><span className="text-zinc-300">Архитектуры Данных</span></h1>
                            <p className="text-xl text-zinc-500 font-medium leading-relaxed">
                                Это полный технический манифест системы. Он описывает, как 12+ источников данных проходят через «Мозг» фильтрации и превращаются в 4 стратегических блока отчетности.
                            </p>
                        </div>
                        <div className="bg-zinc-50 p-10 rounded-[2.5rem] border border-zinc-100 md:w-80">
                            <div className="text-4xl font-black text-zinc-900 mb-2">12+</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-8">Источников данных</div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                    <span className="text-[11px] font-bold uppercase">6 Касаний (Tracking)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                    <span className="text-[11px] font-bold uppercase">Real-time API Sync</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* SECTION 1: SOURCES */}
                <section className="mb-32">
                    <div className="flex items-center gap-4 mb-12">
                        <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-900 border border-zinc-100">
                            <Database className="w-6 h-6" />
                        </div>
                        <h2 className="text-3xl font-black tracking-tight">01. Источники Данных</h2>
                        <div className="h-px flex-1 bg-zinc-100 ml-4" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        {systemMap.sources.map((group, gi) => (
                            <div key={gi} className="space-y-6">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 pl-4">{group.group}</h3>
                                {group.items.map((item, ii) => (
                                    <div key={ii} className="p-8 bg-zinc-50/50 border border-zinc-100 rounded-[2rem] hover:bg-white hover:shadow-xl hover:shadow-zinc-200/30 transition-all group">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-lg font-black tracking-tight text-zinc-900">{item.name}</h4>
                                            <span className="text-[9px] font-black uppercase px-2 py-1 bg-white border border-zinc-200 rounded text-zinc-400 group-hover:border-zinc-900 group-hover:text-zinc-900 transition-colors">
                                                {item.tech}
                                            </span>
                                        </div>
                                        <p className="text-sm text-zinc-500 font-medium leading-relaxed">
                                            {item.details}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </section>

                {/* SECTION 2: LOGIC (THE BRAIN) */}
                <section className="mb-32">
                    <div className="p-16 md:p-24 bg-zinc-900 rounded-[4rem] text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />

                        <div className="relative z-10">
                            <div className="flex items-center gap-4 mb-16">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                                    <Brain className="w-6 h-6 text-white" />
                                </div>
                                <h2 className="text-3xl font-black tracking-tight">02. Мозг (Логика Склейки)</h2>
                                <div className="h-px flex-1 bg-white/10 ml-4" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-16 gap-y-12">
                                {systemMap.logicBrain.map((logic, li) => (
                                    <div key={li} className="group">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="text-zinc-500 font-black text-sm group-hover:text-white transition-colors">{String(li + 1).padStart(2, '0')}</div>
                                            <h4 className="text-lg font-bold tracking-tight">{logic.title}</h4>
                                        </div>
                                        <p className="text-white/50 text-sm font-medium leading-relaxed group-hover:text-white/80 transition-colors">
                                            {logic.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECTION 3: STRUCTURAL BLOCKS */}
                <section className="mb-32">
                    <div className="flex items-center gap-4 mb-12">
                        <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-900 border border-zinc-100">
                            <Layout className="w-6 h-6" />
                        </div>
                        <h2 className="text-3xl font-black tracking-tight">03. Структурные блоки отчета</h2>
                        <div className="h-px flex-1 bg-zinc-100 ml-4" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {systemMap.blocks.map((block, bi) => (
                            <div key={bi} className="p-10 border-2 border-zinc-100 rounded-[3rem] hover:border-zinc-900 transition-all group">
                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-300 mb-10 group-hover:text-zinc-900 transition-colors">Block {block.id}</div>
                                <h3 className="text-xl font-black tracking-tight text-zinc-900 mb-2">{block.title}</h3>
                                <div className="text-[10px] font-bold uppercase text-zinc-400 mb-10">{block.type}</div>
                                <p className="text-sm text-zinc-500 font-medium leading-relaxed">
                                    {block.focus}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* SECTION 4: TECHNICAL EXECUTION DEEP-DIVE */}
                <section className="bg-zinc-50 rounded-[4rem] p-12 md:p-20 border border-zinc-100">
                    <h2 className="text-4xl font-black tracking-tight mb-16 px-4">Техническая реализация (Deep-Dive):</h2>

                    <div className="grid grid-cols-1 gap-8">
                        {/* Point 1: UTM Blending */}
                        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-zinc-200/50">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white font-black">1</div>
                                <h3 className="text-2xl font-black">Сквозная аналитика (Ads &rarr; CRM)</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4">Логика трекинга:</h4>
                                    <ul className="space-y-4 text-sm text-zinc-600 font-medium">
                                        <li className="flex gap-3"><div className="w-1.5 h-1.5 bg-zinc-900 rounded-full mt-1.5 shrink-0" /> <span>YouTube/Facebook Ads &rarr; Ссылка с UTM и CID (Client ID).</span></li>
                                        <li className="flex gap-3"><div className="w-1.5 h-1.5 bg-zinc-900 rounded-full mt-1.5 shrink-0" /> <span>Сайт сохраняет CID в Cookie + LocalStorage на 30 дней.</span></li>
                                        <li className="flex gap-3"><div className="w-1.5 h-1.5 bg-zinc-900 rounded-full mt-1.5 shrink-0" /> <span>При заявке CID передается в AmoCRM в скрытое поле.</span></li>
                                    </ul>
                                </div>
                                <div className="bg-zinc-50 p-8 rounded-2xl border border-zinc-100">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4">Технический стек:</h4>
                                    <p className="text-xs font-mono text-zinc-500 leading-relaxed uppercase tracking-wider">
                                        Join key: utm_campaign_id <br />
                                        Spend Data: Google Ads API / PF API <br />
                                        Revenue Data: AmoCRM Webhooks <br />
                                        Logic: (Commission * Probability) / Spend = ROMI
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Point 2: 6 Touches */}
                        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-zinc-200/50">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white font-black">2</div>
                                <h3 className="text-2xl font-black">Механика '6 касаний'</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4">Как это работает:</h4>
                                    <p className="text-sm text-zinc-600 font-medium leading-relaxed mb-6">
                                        Мы не просто смотрим откуда пришел лид, мы записываем каждое касание в JSON-массив внутри сделки.
                                    </p>
                                    <div className="space-y-3">
                                        <div className="flex gap-3 text-xs font-bold text-zinc-400 uppercase tracking-tighter italic">
                                            <span>#1 Видео на YouTube</span> &rarr; <span>#2 Пост в FB</span> &rarr; <span>#3 Ретаргет</span> &rarr; <span>#4 Переписка</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-zinc-50 p-8 rounded-2xl border border-zinc-100">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4">Реализация:</h4>
                                    <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                                        Использование <b>FingerprintJS</b> для идентификации пользователя без кук. Каждое событие (Event) суммируется в BigQuery или Google Sheets, формируя полную цепочку касаний до момента создания карточки в CRM.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Point 3: Lead Intelligence */}
                        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-zinc-200/50">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white font-black">3</div>
                                <h3 className="text-2xl font-black">Lead Intelligence (Маячок для брокера)</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4">Протокол оповещений:</h4>
                                    <p className="text-sm text-zinc-600 font-medium leading-relaxed">
                                        Когда клиент, который уже есть в базе, заходит на сайт — система делает мгновенный запрос в AmoCRM.
                                    </p>
                                </div>
                                <div className="bg-zinc-900 p-8 rounded-2xl text-white/90">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4 italic">Тех-цепочка:</h4>
                                    <p className="text-xs font-mono leading-relaxed lowercase">
                                        site_visit &rarr; match_cookie_id &rarr; get_lead_id &rarr; send_webhook &rarr; create_amo_task: "клиент [имя] зашел на сайт, позвони сейчас!"
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Point 4: Financial Core */}
                        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-zinc-200/50">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white font-black">4</div>
                                <h3 className="text-2xl font-black">Финансовое ядро (P&L Automation)</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4">Логика вычислений:</h4>
                                    <p className="text-sm text-zinc-600 font-medium leading-relaxed">
                                        Автоматический вычет операционных затрат из комиссии для получения реальной операционной прибыли в разрезе каждого брокера и рекламного канала.
                                    </p>
                                </div>
                                <div className="bg-emerald-50 p-8 rounded-2xl border border-emerald-100">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-4">Формула Profits:</h4>
                                    <div className="text-xl font-black text-emerald-950 tracking-tighter">
                                        Commission - (Ads_Spend + Salary + Rent) = Operation_Margin
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <footer className="mt-48 pt-10 border-t border-zinc-100 flex justify-between items-center opacity-30">
                    <div className="text-[10px] font-black uppercase tracking-[0.4em]">Unified System Manifesto 2024</div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em]">Foryou Analytics Engineering</div>
                </footer>
            </div>
        </div>
    );
}
