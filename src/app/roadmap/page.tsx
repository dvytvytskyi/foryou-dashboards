"use client";

import React from "react";
import Link from "next/link";
import {
    ArrowLeft,
    BookOpen,
    Settings,
    Activity,
    CheckSquare,
    AlertCircle,
    Clock,
    ExternalLink
} from "lucide-react";

const manualSteps = [
    {
        phase: "Этап 1",
        title: "Аудит и чистота входных данных",
        duration: "5-7 рабочих дней",
        importance: "Критически важно: Качество отчетов напрямую зависит от качества данных в CRM. Если в AmoCRM хаос — графики будут показывать ложные цифры.",
        instructions: [
            {
                task: "Стандартизация справочников",
                details: "Проверить поле 'Тип недвижимости'. Должны быть строгие значения: Вторичка, Off-plan, Аренда. Никаких вариаций типа 'вторичный рынок'."
            },
            {
                task: "Аудит UTM-меток",
                details: "Привести все источники к единому реестру. Если одно и то же джерело подписано как 'fb' и 'facebook' — Looker Studio посчитает их разными каналами."
            },
            {
                task: "Настройка 'Обязательности' полей",
                details: "В AmoCRM на этапах 'Успешно' или 'Счет выставлен' поля 'Бюджет' и 'Брокер' должны быть системно обязательными к заполнению."
            },
            {
                task: "Подготовка финансовой таблицы",
                details: "Создание Google Sheets файла для ручного ввода расходов (ЗП, офис, реклама). Это единственный источник для расчета чистой прибыли."
            }
        ]
    },
    {
        phase: "Этап 2",
        title: "Техническая сборка и автоматизация",
        duration: "3-5 рабочих дней",
        importance: "Задача этапа — исключить ручной перенос данных. Все должно течь в отчеты автоматически через 'прокси' хранилище.",
        instructions: [
            {
                task: "Настройка Webhooks/API",
                details: "Интеграция AmoCRM с Google Sheets (через Make/Albato). Сделки должны попадать в таблицу сразу после изменения статуса."
            },
            {
                task: "Подключение Google Sheets к Looker Studio",
                details: "Настройка прямых коннекторов. Важно настроить правильные типы данных (число к числу, дата к дате) на старте."
            },
            {
                task: "Сведение источников (Data Blending)",
                details: "Настройка логики, при которой Looker Studio понимает, что сделка из CRM и расход из финансовой таблицы относятся к одному месяцу."
            }
        ]
    },
    {
        phase: "Этап 3",
        title: "Создание логики и визуализация",
        duration: "10-14 рабочих дней",
        importance: "Это процесс превращения строк данных в бизнес-инструмент. Здесь настраиваются формулы прибыли и KPI.",
        instructions: [
            {
                task: "Расчетные поля (Calculated Fields)",
                details: "Создание формул в Looker Studio: 'Чистая Прибыль = Комиссия - Расходы', '% выполнения плана' и т.д."
            },
            {
                task: "Верстка рабочих областей",
                details: "Создание 4-х основных страниц: Sales Board, Strategic Overview, Expenses Control, Cashflow Forecast."
            },
            {
                task: "Настройка сквозных фильтров",
                details: "Добавление элементов управления: возможность отфильтровать весь отчет по конкретному брокеру, юниту или периоду в один клик."
            }
        ]
    },
    {
        phase: "Этап 4",
        title: "Валидация, обучение и регламент",
        duration: "2-3 рабочих дня",
        importance: "Мало построить отчет — нужно научить команду им пользоваться и поддерживать дисциплину заполнения данных.",
        instructions: [
            {
                task: "Стресс-тест данных",
                details: "Выборочная сверка 20 сделок за разный период. Если цифра в CRM совпадает с цифрой в Looker — отчет валиден."
            },
            {
                task: "Написание мини-регламента",
                details: "Короткая памятка для брокеров: как и когда заполнять поля в CRM, чтобы их статистика в дашборде была корректной."
            },
            {
                task: "Handover сессия",
                details: "Демонстрация руководству: как читать графики, на какие аномалии обращать внимание и как принимать решения на основе этих цифр."
            }
        ]
    }
];

export default function ManualRoadmapPage() {
    return (
        <div className="">
            <div className="">

                {/* Document Header Style */}
                <header className="mb-24 border-b border-zinc-200 pb-16">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                        <h1 className="text-6xl font-black tracking-tighter text-zinc-900 leading-[0.9]">Инструкция по внедрению системы</h1>
                        <div className="px-4 py-1.5 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest rounded-md">
                            Operational Manual v1.0
                        </div>
                    </div>
                    <p className="text-zinc-500 font-medium max-w-2xl text-lg leading-relaxed">
                        Это подробное руководство по реализации аналитики. Документ объединяет технические этапы сборки и бизнес-процессы, которые необходимо настроить для корректной работы отчетов.
                    </p>
                </header>

                {/* Instructions Content */}
                <div className="space-y-32">
                    {manualSteps.map((step, index) => (
                        <section key={index} className="relative">
                            <div className="flex flex-col md:flex-row gap-12">

                                {/* Sidebar Info */}
                                <div className="md:w-64 shrink-0">
                                    <div className="sticky top-12">
                                        <div className="text-6xl font-black text-zinc-100 mb-6 leading-none">{step.phase}</div>
                                        <div className="space-y-4">
                                            {/* Info removed by user request */}
                                        </div>
                                    </div>
                                </div>

                                {/* Main Instruction Body */}
                                <div className="flex-1">
                                    <h2 className="text-3xl font-black tracking-tight text-zinc-900 mb-6">{step.title}</h2>

                                    {/* Importance Note */}
                                    <div className="p-6 bg-zinc-50 border-l-4 border-zinc-900 rounded-r-xl mb-12">
                                        <div className="flex items-center gap-2 mb-2 text-zinc-900">
                                            <AlertCircle className="w-4 h-4" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Почему это важно</span>
                                        </div>
                                        <p className="text-sm text-zinc-600 font-medium leading-relaxed italic">
                                            {step.importance}
                                        </p>
                                    </div>

                                    {/* Tasks List */}
                                    <div className="space-y-8">
                                        {step.instructions.map((inst, ii) => (
                                            <div key={ii} className="pb-8 border-b border-zinc-50 last:border-0 group">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-6 h-6 rounded-md bg-zinc-900 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-1">
                                                        {ii + 1}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-bold text-zinc-900 mb-2 group-hover:text-zinc-600 transition-colors">
                                                            {inst.task}
                                                        </h4>
                                                        <p className="text-sm text-zinc-500 font-medium leading-relaxed">
                                                            {inst.details}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </section>
                    ))}
                </div>

                {/* Footer info */}
                <footer className="mt-48 py-16 border-t border-zinc-100 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 opacity-50">
                            <BookOpen className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Manual Guide</span>
                        </div>
                        <div className="flex items-center gap-2 opacity-50">
                            <Settings className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Technical Spec</span>
                        </div>
                        <div className="flex items-center gap-2 opacity-50">
                            <Activity className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Analytics Ready</span>
                        </div>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">
                        Foryou Dashboard Management © 2024
                    </div>
                </footer>

            </div>
        </div>
    );
}
