"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    Zap,
    ShieldCheck,
    Table as TableIcon,
    LayoutDashboard,
    ChevronRight
} from "lucide-react";
import { reportSections } from "@/lib/constants";

export const Sidebar = () => {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Get active tab from URL or fallback to "overview" if on home page
    const activeTab = pathname === "/" ? (searchParams.get("tab") || "overview") : null;

    const navigateToTab = (id: string) => {
        if (pathname === "/") {
            const params = new URLSearchParams(searchParams.toString());
            params.set("tab", id);
            router.push(`/?${params.toString()}`);
        } else {
            router.push(`/?tab=${id}`);
        }
    };

    const isActive = (path: string) => pathname === path;

    return (
        <div className="fixed inset-y-0 left-0 w-80 bg-white border-r border-zinc-100 flex flex-col z-50 shadow-[1px_0_10px_rgba(0,0,0,0.01)]">
            <div
                className={`p-10 mb-2 pointer-events-auto cursor-pointer transition-all ${activeTab === "overview" ? "bg-zinc-50/50" : ""}`}
                onClick={() => navigateToTab("overview")}
            >
                <div className="flex items-center gap-3 text-zinc-900 mb-2">
                    <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center shadow-lg shadow-zinc-200">
                        <Zap className="w-4 h-4 text-white fill-white" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.2em]">Success Path</span>
                </div>
                <div className="flex items-center justify-between">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.1em]">Protocol v5.4 • Dubai Hub</p>
                    {activeTab === "overview" && (
                        <div className="w-1 h-1 bg-zinc-900 rounded-full" />
                    )}
                </div>
            </div>

            <nav className="flex-1 px-6 space-y-8 overflow-y-auto py-6">
                {/* STAGE 01 */}
                <div className="space-y-3">
                    <div className="px-5 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">01 Стратегия</span>
                        <div className="h-px flex-1 bg-zinc-50 ml-4" />
                    </div>
                    <Link
                        href="/blueprint"
                        className={`w-full text-left px-5 py-4 rounded-xl transition-all flex items-center justify-between group border border-transparent ${isActive("/blueprint")
                            ? "bg-zinc-900 text-white shadow-lg"
                            : "hover:bg-zinc-50/50"
                            }`}
                    >
                        <div>
                            <div className={`text-[11px] font-bold uppercase tracking-wide ${isActive("/blueprint") ? "text-white" : "text-zinc-500 group-hover:text-zinc-900"}`}>
                                Master Blueprint
                            </div>
                            <div className={`text-[10px] font-medium ${isActive("/blueprint") ? "text-zinc-400" : "text-zinc-400"}`}>
                                Глобальная логика
                            </div>
                        </div>
                        <ShieldCheck className={`w-4 h-4 transition-colors ${isActive("/blueprint") ? "text-white" : "text-zinc-200 group-hover:text-zinc-900"}`} />
                    </Link>
                </div>

                {/* STAGE 02 */}
                <div className="space-y-3">
                    <div className="px-5 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">02 План & Аудит</span>
                        <div className="h-px flex-1 bg-zinc-50 ml-4" />
                    </div>
                    <Link
                        href="/roadmap"
                        className={`w-full text-left px-5 py-4 rounded-xl transition-all flex items-center justify-between group border border-transparent ${isActive("/roadmap")
                            ? "bg-zinc-900 text-white shadow-lg"
                            : "hover:bg-zinc-50/50"
                            }`}
                    >
                        <div>
                            <div className={`text-[11px] font-bold uppercase tracking-wide ${isActive("/roadmap") ? "text-white" : "text-zinc-500 group-hover:text-zinc-900"}`}>
                                Roadmap Внедрения
                            </div>
                            <div className="text-[10px] text-zinc-400 font-medium">Что делать сейчас</div>
                        </div>
                        <Zap className={`w-4 h-4 transition-colors ${isActive("/roadmap") ? "text-white" : "text-zinc-200 group-hover:text-zinc-900"}`} />
                    </Link>
                </div>

                {/* STAGE 03 */}
                <div className="space-y-3">
                    <div className="px-5 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">03 Код & Поля</span>
                        <div className="h-px flex-1 bg-zinc-50 ml-4" />
                    </div>
                    <Link
                        href="/tables"
                        className={`w-full text-left px-5 py-4 rounded-xl transition-all flex items-center justify-between group border border-transparent ${isActive("/tables")
                            ? "bg-zinc-900 text-white shadow-lg"
                            : "hover:bg-zinc-50/50"
                            }`}
                    >
                        <div>
                            <div className={`text-[11px] font-bold uppercase tracking-wide ${isActive("/tables") ? "text-white" : "text-zinc-500 group-hover:text-zinc-900"}`}>
                                Инвентарь полей
                            </div>
                            <div className="text-[10px] text-zinc-400 font-medium">AmoCRM API IDs</div>
                        </div>
                        <TableIcon className={`w-4 h-4 transition-colors ${isActive("/tables") ? "text-white" : "text-zinc-200 group-hover:text-zinc-900"}`} />
                    </Link>
                </div>

                {/* STAGE 05 */}
                <div className="space-y-3">
                    <div className="px-5 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">05 Результат</span>
                        <div className="h-px flex-1 bg-zinc-50 ml-4" />
                    </div>
                    <Link
                        href="/results"
                        className={`w-full text-left px-5 py-4 rounded-xl transition-all flex items-center justify-between group border border-transparent ${isActive("/results")
                            ? "bg-zinc-900 text-white shadow-lg"
                            : "hover:bg-zinc-50/50"
                            }`}
                    >
                        <div>
                            <div className={`text-[11px] font-bold uppercase tracking-wide ${isActive("/results") ? "text-white" : "text-zinc-500 group-hover:text-zinc-900"}`}>
                                Результат
                            </div>
                            <div className="text-[10px] text-zinc-400 font-medium">Конечный результат</div>
                        </div>
                        <LayoutDashboard className={`w-4 h-4 transition-colors ${isActive("/results") ? "text-white" : "text-zinc-200 group-hover:text-zinc-900"}`} />
                    </Link>
                </div>

                {/* STAGE 04 */}
                <div className="space-y-3">
                    <div className="px-5 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">04 Анализ Блоков</span>
                        <div className="h-px flex-1 bg-zinc-50 ml-4" />
                    </div>
                    {reportSections.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => navigateToTab(s.id)}
                            className={`w-full text-left px-5 py-4 rounded-xl transition-all flex items-center justify-between group ${activeTab === s.id
                                ? "bg-zinc-50 border border-zinc-100 shadow-sm"
                                : "hover:bg-zinc-50/50 border border-transparent"
                                }`}
                        >
                            <div>
                                <div className={`text-[11px] font-bold uppercase tracking-wide ${activeTab === s.id ? "text-zinc-900" : "text-zinc-500"}`}>
                                    {s.title}
                                </div>
                                <div className="text-[10px] text-zinc-400 font-medium">{s.tag}</div>
                            </div>
                            <ChevronRight className={`w-4 h-4 transition-all ${activeTab === s.id ? "text-zinc-900 translate-x-1" : "text-zinc-200 opacity-0"}`} />
                        </button>
                    ))}
                </div>
            </nav>

            <div className="p-10 border-t border-zinc-50">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-1" />
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest tracking-tighter">Live Structure</span>
                </div>
            </div>
        </div>
    );
};
