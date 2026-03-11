"use client";

import React from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Table as TableIcon,
    Database,
    Zap,
    Download
} from "lucide-react";

const tableSpecs = [
    {
        module: "Блок А: Отдел Продаж (Real Estate Pipeline: 8696950)",
        fields: [
            { name: "ID Сделки", type: "Integer", desc: "Уникальный lead_id в AmoCRM", required: "Да" },
            { name: "Брокер (ID: 1343903)", type: "String", desc: "ФИО ответственного менеджера (сейчас текстовое поле)", required: "Да" },
            { name: "Дата закрытия", type: "Date", desc: "Дата перехода в status_id: 142 (квартира оплачена)", required: "Да" },
            { name: "Стоимость юнита (ID: 1343899)", type: "Numeric", desc: "Полная сумма сделки из карточки", required: "Да" },
            { name: "Тип сделки (ID: 703143)", type: "Select", desc: "Options: off-plan (ID: 695201), вторичка (ID: 695203)", required: "Да" },
            { name: "Источник (ID: 703131)", type: "Select", desc: "Master field: Property Finder, Bayut, YouTube, RED_RU etc.", required: "Да" }
        ]
    },
    {
        module: "Блок Б: Вся Компания / Партнеры",
        fields: [
            { name: "Тип клиента (ID: 703153)", type: "Select", desc: "Options: Клиент (ID: 695221), Агент (ID: 695223)", required: "Да" },
            { name: "Наименование юнита (ID: 1343883)", type: "String", desc: "Название ЖК или объекта недвижимости", required: "Да" },
            { name: "Брокер сопровождения", type: "User", desc: "ID пользователя AmoCRM, ответственного за пост-сейл", required: "Да" },
            { name: "Дата выплаты", type: "Date", desc: "Дата фактического поступления средств в кассу", required: "Да" }
        ]
    },
    {
        module: "Блок Г: Инвойсы (Pipeline Бухгалтерия: 10633834)",
        fields: [
            { name: "Статус Инвойса", type: "Status", desc: "Stage ID: 83955706 (Инвойс выставлен)", required: "Да" },
            { name: "Ожидаемая дата", type: "Date", desc: "Плановая дата поступления (из задач или доп-поля)", required: "Да" },
            { name: "Сумма комиссии брокера (ID: 1343909)", type: "Numeric", desc: "Автоматически рассчитанная сумма выплаты брокеру", required: "Да" },
            { name: "Комиссия застройщика, % (ID: 1343901)", type: "Numeric", desc: "Процент комиссии от ЖК", required: "Да" }
        ]
    }
];

export default function TablesPage() {
    return (
        <div className="">
            <div className="">

                {/* Header */}
                <header className="mb-20 flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div>
                        <h1 className="text-6xl font-black tracking-tighter text-zinc-900 mb-8 leading-[0.9]">Data Inventory</h1>
                        <p className="text-zinc-500 font-medium max-w-xl">
                            Детальные спецификации полей AmoCRM на основе проведенного технического аудита.
                        </p>
                    </div>
                </header>

                {/* Dynamic Tables */}
                <div className="space-y-32">
                    {tableSpecs.map((table, index) => (
                        <div key={index} className="relative">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-10 h-10 bg-zinc-50 border border-zinc-100 rounded-xl flex items-center justify-center text-zinc-900">
                                    <TableIcon className="w-5 h-5" />
                                </div>
                                <h2 className="text-xl font-black tracking-tight text-zinc-900">{table.module}</h2>
                                <div className="h-px flex-1 bg-zinc-100 ml-4" />
                            </div>

                            <div className="overflow-hidden border border-zinc-100 rounded-2xl bg-white shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-zinc-50/50 border-b border-zinc-100">
                                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 w-1/4">Название поля (AmoID)</th>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 w-1/6">Тип данных</th>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 w-2/5">Описание</th>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Обязательно?</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-50">
                                        {table.fields.map((field, fi) => (
                                            <tr key={fi} className="group hover:bg-zinc-50/50 transition-colors">
                                                <td className="px-8 py-6 align-top">
                                                    <span className="text-sm font-bold text-zinc-900 tracking-tight">{field.name}</span>
                                                </td>
                                                <td className="px-8 py-6 align-top">
                                                    <span className="inline-block px-2.5 py-1 bg-zinc-50 border border-zinc-100 text-[9px] font-bold text-zinc-500 uppercase rounded-md">
                                                        {field.type}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 align-top">
                                                    <p className="text-[13px] text-zinc-600 font-medium leading-relaxed">
                                                        {field.desc}
                                                    </p>
                                                </td>
                                                <td className="px-8 py-6 align-top text-right">
                                                    <div className={`text-[10px] font-black uppercase tracking-widest ${field.required === "Да" ? "text-emerald-500" : "text-zinc-300"}`}>
                                                        {field.required}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>

                {/* TECHNICAL RECOMMENDATIONS SECTION */}
                <section className="mt-48 bg-zinc-900 rounded-[3rem] p-12 md:p-20 text-white shadow-2xl">
                    <div className="max-w-4xl">
                        <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/10 rounded-full mb-10">
                            <Zap className="w-4 h-4 text-emerald-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Результаты технического аудита</span>
                        </div>
                        <h2 className="text-4xl font-black tracking-tight mb-8">Технические правки для AmoCRM</h2>
                        <p className="text-zinc-400 font-medium mb-16 leading-relaxed">
                            Основываясь на анализе вашего аккаунта `reforyou.amocrm.ru`, необходимо внедрить следующие изменения для корректной работы дашбордов.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-12">
                                <div>
                                    <h3 className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-6">#1 Чистота данных</h3>
                                    <ul className="space-y-6">
                                        <li className="flex gap-4">
                                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 shrink-0" />
                                            <p className="text-sm font-bold text-zinc-200">Поле "Брокер": Перевести из текста в "Список" (Select). Это исключит ошибки в написании имен брокеров.</p>
                                        </li>
                                        <li className="flex gap-4">
                                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 shrink-0" />
                                            <p className="text-sm font-bold text-zinc-200">Поле "Источник": Использовать API-метки Property Finder для 100% автозаполнения.</p>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                            <div className="space-y-12">
                                <div>
                                    <h3 className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-6">#2 Автоматизация</h3>
                                    <ul className="space-y-6">
                                        <li className="flex gap-4">
                                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 shrink-0" />
                                            <p className="text-sm font-bold text-zinc-200">SalesBot: Запретить перевод сделки в "Закрыто", если не заполнена сумма и тип недвижимости.</p>
                                        </li>
                                        <li className="flex gap-4">
                                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 shrink-0" />
                                            <p className="text-sm font-bold text-zinc-200">Формулы: Настроить авто-расчет выплаты брокеру прямо в карточке (Стоимость * %).</p>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="mt-48 py-10 border-t border-zinc-100 flex justify-between items-center opacity-50">
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-zinc-900" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Technical Inventory v1.0</span>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em]">Foryou Dashboards</div>
                </footer>
            </div>
        </div>
    );
}
