"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Database,
  Cpu,
  BarChart3,
  Globe,
  TrendingUp,
  Table as TableIcon,
  ClipboardCheck,
  Zap,
  ShieldCheck,
  LayoutDashboard
} from "lucide-react";
import { reportSections } from "@/lib/constants";

// --- UNIFIED COMPONENTS ---

const SectionHeader = ({ title, icon: Icon, step }: any) => (
  <div className="flex items-center gap-4 mb-8">
    <div className="flex-none w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-lg shadow-zinc-200">
      <Icon className="w-5 h-5" />
    </div>
    <div className="flex-1">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-0.5">Раздел {step}</div>
      <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900">{title}</h3>
    </div>
    <div className="h-px w-24 bg-zinc-100" />
  </div>
);

const ContentCard = ({ children, className = "", onClick }: any) => (
  <div
    onClick={onClick}
    className={`bg-white border border-zinc-100 rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.02)] transition-all duration-300 ${className}`}
  >
    {children}
  </div>
);

export default function UnifiedDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") || "overview";

  const changeTab = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.push(`/?${params.toString()}`);
  };

  const active = reportSections.find(s => s.id === activeTab);

  return (
    <div className="min-h-screen text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white">
      <AnimatePresence mode="wait">
        {activeTab === "overview" ? (
          <motion.div
            transition={{ duration: 0.4 }}
            className=""
          >
            <header className="mb-24">
              <div className="inline-block px-3 py-1 bg-zinc-900 text-white rounded text-[9px] font-black uppercase tracking-widest mb-6">
                Начало работы
              </div>
              <h1 className="text-6xl font-black text-zinc-900 tracking-tighter mb-8 leading-[0.9]">
                МАРШРУТ<br />ВНЕДРЕНИЯ
              </h1>
              <p className="text-xl text-zinc-500 leading-relaxed font-medium max-w-2xl border-l-2 border-zinc-100 pl-8">
                Добро пожаловать в архитектурный хаб ForYou. Чтобы успешно запустить аналитику, рекомендуем изучать материалы в строгой последовательности.
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                {
                  step: "01",
                  title: "СТРАТЕГИЯ",
                  desc: "Master Blueprint. Изучите логику склеивания данных и финансовые формулы.",
                  link: "/blueprint",
                  icon: ShieldCheck
                },
                {
                  step: "02",
                  title: "ПЛАН & АУДИТ",
                  desc: "Roadmap. Конкретный список действий: что исправить в AmoCRM и какие доступы дать.",
                  link: "/roadmap",
                  icon: Zap
                },
                {
                  step: "03",
                  title: "КОД & ТАБЛИЦЫ",
                  desc: "Инвентарь полей. Список ID для настройки интеграции через Make.com / API.",
                  link: "/tables",
                  icon: TableIcon
                },
                {
                  step: "04",
                  title: "БЛОКИ ДАННЫХ",
                  desc: "Технический анализ источников (Продажи, Расходы, Инвойсы). Перейдите в меню слева.",
                  link: "#",
                  icon: Cpu
                },
                {
                  step: "05",
                  title: "РЕЗУЛЬТАТ",
                  desc: "Детальное описание финальных графиков и таблиц в вашей Looker Studio.",
                  link: "/results",
                  icon: LayoutDashboard
                }
              ].map((item, i) => (
                <ContentCard key={i} className="p-10 hover:border-zinc-300 group cursor-pointer" onClick={() => item.link !== "#" ? router.push(item.link) : null}>
                  <div className="flex items-start justify-between mb-8">
                    <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-300 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                      <item.icon className="w-6 h-6" />
                    </div>
                    <span className="text-3xl font-black text-zinc-50 group-hover:text-zinc-100 transition-colors tracking-tighter">{item.step}</span>
                  </div>
                  <h4 className="text-lg font-black text-zinc-900 mb-2 tracking-tight">{item.title}</h4>
                  <p className="text-[13px] text-zinc-500 font-medium leading-relaxed">{item.desc}</p>
                </ContentCard>
              ))}
            </div>
          </motion.div>
        ) : active ? (
          <motion.div
            transition={{ duration: 0.4, ease: "easeOut" }}
            className=""
          >
            {/* Page Header */}
            <header className="mb-24">
              <div className="inline-block px-3 py-1 bg-zinc-900 text-white rounded text-[9px] font-black uppercase tracking-widest mb-6">
                #{active.tag}
              </div>
              <h1 className="text-6xl font-black text-zinc-900 tracking-tighter mb-8 leading-[0.9]">
                {active.title}
              </h1>
              <p className="text-xl text-zinc-500 leading-relaxed font-medium max-w-2xl border-l-2 border-zinc-100 pl-8">
                {active.description}
              </p>
            </header>

            {/* SECTION 1: SOURCES */}
            <div className="mb-24">
              <SectionHeader title="Источники данных" icon={Database} step="01" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {active.sources.map((src: any, i: number) => (
                  <ContentCard key={i} className="p-8 hover:border-zinc-300 group">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white transition-all duration-300">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-900 tracking-tight">{src.name}</h4>
                        <span className="text-[10px] uppercase font-bold text-zinc-300 tracking-[0.1em]">{src.type}</span>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-500 leading-relaxed font-medium mb-8 min-h-[4rem]">
                      {src.details}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-6 border-t border-zinc-50">
                      {src.specs.map((spec: string, si: number) => (
                        <span key={si} className="px-3 py-1 bg-zinc-50 text-[9px] font-bold text-zinc-400 uppercase rounded-md">
                          {spec}
                        </span>
                      ))}
                    </div>
                  </ContentCard>
                ))}
              </div>
            </div>

            {/* SECTION 2: TASKS */}
            <div className="mb-24">
              <SectionHeader title="Бизнес-Задачи" icon={Cpu} step="02" />
              <ContentCard className="divide-y divide-zinc-50">
                {active.tasks.map((task: any, i: number) => (
                  <div key={i} className="p-6 md:p-8 flex items-center justify-between hover:bg-zinc-50/50 transition-colors group">
                    <div className="flex items-center gap-8">
                      <div className="text-lg font-black text-zinc-100 group-hover:text-zinc-900 transition-colors w-6">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-900 mb-1">{task.title}</h4>
                        <p className="text-[13px] text-zinc-500 font-medium leading-relaxed">{task.goal}</p>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-zinc-50 text-[9px] font-black uppercase text-zinc-400 rounded-md group-hover:bg-zinc-900 group-hover:text-white transition-all whitespace-nowrap ml-4">
                      {task.badge}
                    </div>
                  </div>
                ))}
              </ContentCard>
            </div>

            {/* SECTION 3: VISUALIZATIONS */}
            <div className="mb-24">
              <SectionHeader title="Визуализация" icon={BarChart3} step="03" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {active.visualizations.map((viz: any, i: number) => (
                  <ContentCard key={i} className="p-10 flex flex-col items-center text-center hover:bg-zinc-50/30">
                    <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-300 group-hover:text-zinc-900 transition-all mb-6">
                      <viz.icon className="w-6 h-6" />
                    </div>
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-800 mb-2">{viz.name}</h4>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase">{viz.desc}</p>
                  </ContentCard>
                ))}
              </div>
            </div>

            {/* SECTION 4: REQUIREMENTS (THE TABLE) */}
            <div className="mb-24">
              <SectionHeader title="Технические требования к данным" icon={ClipboardCheck} step="04" />
              <ContentCard className="overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/50 border-b border-zinc-100">
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 w-1/4">Параметр</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 w-1/2">Описание / Поля</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 w-1/4 text-right">Контекст</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {active.requirements?.map((req: any, i: number) => (
                      <tr key={i} className="group hover:bg-zinc-50/50 transition-colors">
                        <td className="px-8 py-6 align-top">
                          <span className="text-sm font-bold text-zinc-900 tracking-tight">{req.item}</span>
                        </td>
                        <td className="px-8 py-6 align-top">
                          <div className="space-y-2">
                            {Array.isArray(req.desc) ? (
                              req.desc.map((line: string, li: number) => (
                                <div key={li} className="text-[13px] text-zinc-600 font-medium leading-relaxed flex items-start gap-2">
                                  <span className="w-1 h-1 rounded-full bg-zinc-200 mt-2 shrink-0" />
                                  {line}
                                </div>
                              ))
                            ) : (
                              <p className="text-[13px] text-zinc-600 font-medium leading-relaxed">{req.desc}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6 align-top text-right">
                          <span className="inline-block px-3 py-1 bg-zinc-50 text-[9px] font-black uppercase text-zinc-400 rounded-md tracking-[0.15em] whitespace-nowrap">
                            {req.context}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ContentCard>
            </div>

            <footer className="mt-48 pt-10 border-t border-zinc-100 flex justify-between items-center">
              <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300">Architecture Unified v5.4</div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Dubai Hub 2024</div>
            </footer>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
