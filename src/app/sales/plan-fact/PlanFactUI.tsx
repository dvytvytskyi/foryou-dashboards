'use client';

import React, { useEffect, useMemo, useState } from 'react';
import styles from './plan-fact.module.css';
import { BarChart3, ChevronDown, ChevronRight, Target, Trophy, Activity, Users } from 'lucide-react';
import { formatNumber, formatPercent } from '@/lib/formatters';

type KpiRow = {
  label: string;
  actual: number;
  plan: number;
  suffix: string;
};

type SourceRow = {
  source: string;
  received: number;
  prevReceived: number;
  ql: number;
  showings: number;
  deals: number;
  activeTotal: number;
  activeQl: number;
  activeShowings: number;
  activeReanimation: number;
  missed: number;
  allTotal: number;
  allLost: number;
  allQl: number;
  allShowings: number;
  allDeals: number;
  revenueWon: number;
  overdue: number;
};

type BrokerRow = {
  id: number;
  name: string;
  received: number;
  prevReceived: number;
  ql: number;
  showings: number;
  deals: number;
  activeTotal: number;
  activeQl: number;
  activeShowings: number;
  activeReanimation: number;
  missed: number;
  allTotal: number;
  allLost: number;
  allQl: number;
  allShowings: number;
  allDeals: number;
  revenueWon: number;
  overdue: number;
  sourceRows: SourceRow[];
};

type PlanFactResponse = {
  success: boolean;
  error?: string;
  kpis: KpiRow[];
  brokers: BrokerRow[];
  partners: BrokerRow[];
};

const SOURCE_COLORS: Record<string, string> = {
  Red: '#ef4444',
  'Primary Plus': '#f97316',
  'Property Finder': '#f59e0b',
  Klykov: '#10b981',
  Oman: '#06b6d4',
  Facebook: '#3b82f6',
  'Partners leads': '#a855f7',
  'Own leads': '#64748b',
};

function PlanProgress({ actual, plan }: { actual: number; plan: number }) {
  const percent = plan > 0 ? Math.round((actual / plan) * 100) : 0;
  const color = percent >= 80 ? '#10b981' : percent >= 50 ? '#f59e0b' : '#f43f5e';

  return (
    <div style={{ marginTop: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '6px' }}>
        <span style={{ color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.05em' }}>ВЫПОЛНЕНИЕ</span>
        <span style={{ color, fontWeight: 800 }}>{percent}%</span>
      </div>
      <div style={{ 
        height: '10px', 
        background: 'rgba(128, 128, 128, 0.1)', 
        borderRadius: '5px', 
        overflow: 'hidden',
        position: 'relative',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)'
      }}>
        <div style={{ 
          width: `${Math.min(percent, 100)}%`, 
          height: '100%',
          backgroundColor: color,
          borderRadius: '5px',
          boxShadow: '0 0 10px ' + color + '44'
        }} />
      </div>
    </div>
  );
}

function growth(current: number, prev: number) {
  if (!prev) return current > 0 ? null : 0;
  return ((current - prev) / prev) * 100;
}

function GrowthCell({ current, prev }: { current: number; prev: number }) {
  const g = growth(current, prev);
  if (g === null) return <td style={{ color: 'var(--muted)', fontSize: '11px' }}>нет данных</td>;
  const sign = g > 0 ? '+' : '';
  const color = g > 0 ? '#10b981' : g < 0 ? '#f43f5e' : 'var(--muted)';
  return (
    <td style={{ color, fontWeight: 600, fontSize: '13px' }}>
      {sign}{Math.round(g)}%
    </td>
  );
}

function calcRate(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}

function PlanFactSkeleton() {
  return (
    <div className={styles.container}>
      <div className={styles.summaryGrid}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${styles.kpiCard} ${styles.skeleton}`} style={{ height: '140px' }} />
        ))}
      </div>

      <div className={styles.section} style={{ marginTop: '24px', padding: '24px' }}>
        <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className={`${styles.skeleton} ${styles.skeletonRow}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

type SourceAggregate = {
  source: string;
  totals: SourceRow;
  brokers: Array<{ id: number; name: string } & SourceRow>;
};

type SortState = { col: string | null; dir: 'asc' | 'desc' };

type SortableBrokerKey = keyof Omit<BrokerRow, 'id' | 'name' | 'sourceRows'>;
type SortableSourceKey = keyof Omit<SourceRow, 'source'>;

function getSortValue(row: BrokerRow | SourceRow, col: string): number {
  const r = row as Record<string, unknown>;
  const v = r[col];
  if (typeof v === 'number') return v;
  // computed percent columns
  if (col === 'crQl') return calcRate((row as BrokerRow).ql, (row as BrokerRow).received);
  if (col === 'crShowing') return calcRate((row as BrokerRow).showings, (row as BrokerRow).received);
  if (col === 'allCrQl') return calcRate((row as BrokerRow).allQl, (row as BrokerRow).allTotal);
  if (col === 'allCrShowing') return calcRate((row as BrokerRow).allShowings, (row as BrokerRow).allTotal);
  // source row percent columns
  if (col === 'srcCrQl') return calcRate((row as SourceRow).ql, (row as SourceRow).received);
  if (col === 'srcCrShowing') return calcRate((row as SourceRow).showings, (row as SourceRow).received);
  if (col === 'allSrcCrQl') return calcRate((row as SourceRow).allQl, (row as SourceRow).allTotal);
  if (col === 'allSrcCrShowing') return calcRate((row as SourceRow).allShowings, (row as SourceRow).allTotal);
  return 0;
}

function sortRows<T>(rows: T[], sort: SortState, getVal: (row: T, col: string) => number): T[] {
  if (!sort.col) return rows;
  return [...rows].sort((a, b) => {
    const diff = getVal(a, sort.col!) - getVal(b, sort.col!);
    return sort.dir === 'asc' ? diff : -diff;
  });
}

function SortTh({ col, sort, setSort, children, style }: {
  col: string;
  sort: SortState;
  setSort: (s: SortState) => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const active = sort.col === col;
  return (
    <th
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
      onClick={() => setSort({ col, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {children}
        {active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : <span style={{ color: 'var(--muted)', fontSize: '9px' }}> ⇅</span>}
      </span>
    </th>
  );
}

// Shared broker table (used for OP and Partners)
function BrokerTable({
  rows,
  title,
  icon,
  expanded,
  toggleExpanded,
  expandedSrc,
  toggleExpandedSrc,
  sort,
  setSort,
}: {
  rows: BrokerRow[];
  title: string;
  icon: React.ReactNode;
  expanded: Record<string, boolean>;
  toggleExpanded: (name: string) => void;
  expandedSrc: Record<string, boolean>;
  toggleExpandedSrc: (name: string) => void;
  sort: SortState;
  setSort: (s: SortState) => void;
}) {
  // When any broker row is expanded, don't re-order broker rows — only sort subrows
  const anyExpanded = Object.values(expanded).some(Boolean);
  const sortedRows = anyExpanded ? rows : sortRows(rows, sort, getSortValue);

  // Build source-first aggregation for "Источники" sub-table
  const sourceAgg = useMemo<SourceAggregate[]>(() => {
    const map = new Map<string, SourceAggregate>();
    const emptyMetrics = (): Omit<SourceRow, 'source'> => ({
      received: 0, prevReceived: 0, ql: 0, showings: 0, deals: 0,
      activeTotal: 0, activeQl: 0, activeShowings: 0, activeReanimation: 0, missed: 0,
      allTotal: 0, allLost: 0, allQl: 0, allShowings: 0, allDeals: 0, revenueWon: 0, overdue: 0,
    });
    const addMetrics = (dest: Omit<SourceRow, 'source'>, src: Omit<SourceRow, 'source'>) => {
      for (const k of Object.keys(dest) as Array<keyof typeof dest>) {
        (dest[k] as number) += (src[k] as number);
      }
    };
    for (const broker of rows) {
      for (const sr of broker.sourceRows) {
        if (!map.has(sr.source)) {
          map.set(sr.source, { source: sr.source, totals: { source: sr.source, ...emptyMetrics() }, brokers: [] });
        }
        const agg = map.get(sr.source)!;
        addMetrics(agg.totals, sr);
        agg.brokers.push({ id: broker.id, name: broker.name, ...sr });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totals.received - a.totals.received);
  }, [rows]);

  const thStyle = (col: string, bg: string): React.CSSProperties => ({
    minWidth: '100px',
    background: bg,
    ...(sort.col === col ? { color: 'var(--accent)' } : {}),
  });

  return (
    <>
      {/* ── Broker-first table ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            {icon}
            <span>{title}</span>
          </div>
        </div>

        <div className={styles.tableWrapper} style={{ overflowX: 'auto' }}>
          <div className={styles.tableScroll} style={{ maxHeight: 'none' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className={styles.stickyCell}
                    style={{ minWidth: '220px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Trophy size={14} />
                      <span>ФИО брокера</span>
                    </div>
                  </th>
                  <th colSpan={8} style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', background: 'var(--bg-0)', padding: '12px' }}>&nbsp;</th>
                  <th colSpan={6} className={styles.group2Cell} style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', color: 'var(--white-soft)', padding: '12px' }}>ЧТО СЕЙЧАС В РАБОТЕ</th>
                  <th colSpan={6} className={styles.group3Cell} style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', color: 'var(--white-soft)', padding: '12px' }}>В ЦЕЛОМ ЗА ВЕСЬ СРОК РАБОТЫ</th>
                </tr>
                <tr>
                  <SortTh col="received" sort={sort} setSort={setSort} style={thStyle('received', 'var(--panel-2)')}>Всего получил</SortTh>
                  <SortTh col="prevReceived" sort={sort} setSort={setSort} style={{ minWidth: '120px', background: 'var(--panel-2)' }}>Всего получил (прош.)</SortTh>
                  <SortTh col="growth" sort={sort} setSort={setSort} style={{ minWidth: '150px', background: 'var(--panel-2)' }}>Сравнение</SortTh>
                  <SortTh col="ql" sort={sort} setSort={setSort} style={thStyle('ql', 'var(--panel-2)')}>QL leads</SortTh>
                  <SortTh col="crQl" sort={sort} setSort={setSort} style={{ minWidth: '120px', background: 'var(--panel-2)' }}>CR Lead - QL</SortTh>
                  <SortTh col="showings" sort={sort} setSort={setSort} style={thStyle('showings', 'var(--panel-2)')}>ПП/Показ+</SortTh>
                  <SortTh col="crShowing" sort={sort} setSort={setSort} style={{ minWidth: '120px', background: 'var(--panel-2)' }}>CR Lead - Показ</SortTh>
                  <SortTh col="deals" sort={sort} setSort={setSort} style={thStyle('deals', 'var(--panel-2)')}>Сделка</SortTh>

                  <SortTh col="activeTotal" sort={sort} setSort={setSort} style={thStyle('activeTotal', 'rgba(128,128,128,0.08)')}>Total leads</SortTh>
                  <SortTh col="activeQl" sort={sort} setSort={setSort} style={thStyle('activeQl', 'rgba(128,128,128,0.08)')}>QL Actual</SortTh>
                  <SortTh col="activeShowings" sort={sort} setSort={setSort} style={thStyle('activeShowings', 'rgba(128,128,128,0.08)')}>Показ+</SortTh>
                  <SortTh col="activeReanimation" sort={sort} setSort={setSort} style={thStyle('activeReanimation', 'rgba(128,128,128,0.08)')}>Реанимация</SortTh>
                  <SortTh col="overdue" sort={sort} setSort={setSort} style={{ minWidth: '150px', background: 'rgba(128,128,128,0.08)' }}>Просроченых задач</SortTh>
                  <SortTh col="missed" sort={sort} setSort={setSort} style={thStyle('missed', 'rgba(128,128,128,0.08)')}>Упущено</SortTh>

                  <SortTh col="allTotal" sort={sort} setSort={setSort} style={thStyle('allTotal', 'rgba(128,128,128,0.15)')}>Total leads</SortTh>
                  <SortTh col="allQl" sort={sort} setSort={setSort} style={thStyle('allQl', 'rgba(128,128,128,0.15)')}>QL Leads</SortTh>
                  <SortTh col="allCrQl" sort={sort} setSort={setSort} style={{ minWidth: '120px', background: 'rgba(128,128,128,0.15)' }}>CR Lead - QL</SortTh>
                  <SortTh col="allShowings" sort={sort} setSort={setSort} style={thStyle('allShowings', 'rgba(128,128,128,0.15)')}>Показ+</SortTh>
                  <SortTh col="allCrShowing" sort={sort} setSort={setSort} style={{ minWidth: '120px', background: 'rgba(128,128,128,0.15)' }}>CR Lead - Показ</SortTh>
                  <SortTh col="allDeals" sort={sort} setSort={setSort} style={thStyle('allDeals', 'rgba(128,128,128,0.15)')}>Сделка</SortTh>
                </tr>
              </thead>

              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td className={styles.stickyCell} colSpan={21} style={{ textAlign: 'center', padding: '24px' }}>
                      Нет данных за выбранный период.
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((b) => {
                    const isExpanded = !!expanded[b.name];
                    const sortedSrc = sortRows(b.sourceRows, sort, getSortValue);
                    return (
                      <React.Fragment key={b.id}>
                        <tr style={{ cursor: 'pointer' }} onClick={() => toggleExpanded(b.name)}>
                          <td className={styles.stickyCell}>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isExpanded ? <ChevronDown size={14} className={styles.dimmed} /> : <ChevronRight size={14} className={styles.dimmed} />}
                              {b.name}
                            </div>
                          </td>
                          <td style={{ fontWeight: 700 }}>{b.received}</td>
                          <td>{b.prevReceived}</td>
                          <GrowthCell current={b.received} prev={b.prevReceived} />
                          <td style={{ color: 'var(--white-soft)', fontWeight: 600 }}>{b.ql}</td>
                          <td>{formatPercent(calcRate(b.ql, b.received))}</td>
                          <td>{b.showings}</td>
                          <td>{formatPercent(calcRate(b.showings, b.received))}</td>
                          <td>{b.deals}</td>

                          <td className={styles.group2Cell}>{b.activeTotal}</td>
                          <td className={styles.group2Cell} style={{ color: 'var(--white-soft)', fontWeight: 600 }}>{b.activeQl}</td>
                          <td className={styles.group2Cell}>{b.activeShowings}</td>
                          <td className={styles.group2Cell} style={{ color: (b.activeReanimation || 0) > 0 ? '#f97316' : 'inherit' }}>{b.activeReanimation || 0}</td>
                          <td className={styles.group2Cell} style={{ color: b.overdue > 0 ? '#f43f5e' : 'inherit' }}>{b.overdue}</td>
                          <td className={styles.group2Cell}>{b.missed}</td>

                          <td className={styles.group3Cell}>{b.allTotal}</td>
                          <td className={styles.group3Cell} style={{ color: 'var(--white-soft)', fontWeight: 600 }}>{b.allQl}</td>
                          <td className={styles.group3Cell}>{formatPercent(calcRate(b.allQl, b.allTotal))}</td>
                          <td className={styles.group3Cell}>{b.allShowings}</td>
                          <td className={styles.group3Cell}>{formatPercent(calcRate(b.allShowings, b.allTotal))}</td>
                          <td className={styles.group3Cell} style={{ fontWeight: 700, color: 'var(--white-soft)' }}>{b.allDeals}</td>
                        </tr>
                        {isExpanded && sortedSrc.map((s) => (
                          <tr key={`${b.id}-${s.source}`} className={styles.subRowCell}>
                            <td className={styles.subRowSticky}>
                              <div style={{ fontSize: '12px', color: 'var(--white-soft)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: SOURCE_COLORS[s.source] || '#94a3b8' }} />
                                {s.source}
                              </div>
                            </td>
                            <td>{s.received}</td>
                            <td>{s.prevReceived}</td>
                            <GrowthCell current={s.received} prev={s.prevReceived} />
                            <td>{s.ql}</td>
                            <td>{formatPercent(calcRate(s.ql, s.received))}</td>
                            <td>{s.showings}</td>
                            <td>{formatPercent(calcRate(s.showings, s.received))}</td>
                            <td>{s.deals}</td>
                            <td className={styles.group2Cell}>{s.activeTotal}</td>
                            <td className={styles.group2Cell}>{s.activeQl}</td>
                            <td className={styles.group2Cell}>{s.activeShowings}</td>
                            <td className={styles.group2Cell}>{s.activeReanimation || 0}</td>
                            <td className={styles.group2Cell}>0</td>
                            <td className={styles.group2Cell}>{s.missed}</td>
                            <td className={styles.group3Cell}>{s.allTotal}</td>
                            <td className={styles.group3Cell}>{s.allQl}</td>
                            <td className={styles.group3Cell}>{formatPercent(calcRate(s.allQl, s.allTotal))}</td>
                            <td className={styles.group3Cell}>{s.allShowings}</td>
                            <td className={styles.group3Cell}>{formatPercent(calcRate(s.allShowings, s.allTotal))}</td>
                            <td className={styles.group3Cell}>{s.allDeals}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Source-first table ── */}
      <div className={styles.section} style={{ marginTop: '24px' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <BarChart3 size={14} />
            <span>Эффективность источников (брокеры в дропдауне)</span>
          </div>
        </div>

        <div className={styles.tableWrapper} style={{ overflowX: 'auto' }}>
          <div className={styles.tableScroll} style={{ maxHeight: 'none' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th rowSpan={2} className={styles.stickyCell} style={{ minWidth: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Target size={14} />
                      <span>Источник</span>
                    </div>
                  </th>
                  <th colSpan={8} style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', background: 'var(--bg-0)', padding: '12px' }}>&nbsp;</th>
                  <th colSpan={6} className={styles.group2Cell} style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', color: 'var(--white-soft)', padding: '12px' }}>ЧТО СЕЙЧАС В РАБОТЕ</th>
                  <th colSpan={6} className={styles.group3Cell} style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', color: 'var(--white-soft)', padding: '12px' }}>В ЦЕЛОМ ЗА ВЕСЬ СРОК РАБОТЫ</th>
                </tr>
                <tr>
                  <SortTh col="received" sort={sort} setSort={setSort} style={thStyle('received', 'var(--panel-2)')}>Всего получил</SortTh>
                  <SortTh col="prevReceived" sort={sort} setSort={setSort} style={{ minWidth: '120px', background: 'var(--panel-2)' }}>Всего получил (прош.)</SortTh>
                  <SortTh col="growth" sort={sort} setSort={setSort} style={{ minWidth: '150px', background: 'var(--panel-2)' }}>Сравнение</SortTh>
                  <SortTh col="ql" sort={sort} setSort={setSort} style={thStyle('ql', 'var(--panel-2)')}>QL leads</SortTh>
                  <SortTh col="crQl" sort={sort} setSort={setSort} style={{ minWidth: '120px', background: 'var(--panel-2)' }}>CR Lead - QL</SortTh>
                  <SortTh col="showings" sort={sort} setSort={setSort} style={thStyle('showings', 'var(--panel-2)')}>ПП/Показ+</SortTh>
                  <SortTh col="crShowing" sort={sort} setSort={setSort} style={{ minWidth: '120px', background: 'var(--panel-2)' }}>CR Lead - Показ</SortTh>
                  <SortTh col="deals" sort={sort} setSort={setSort} style={thStyle('deals', 'var(--panel-2)')}>Сделка</SortTh>
                  <SortTh col="activeTotal" sort={sort} setSort={setSort} style={thStyle('activeTotal', 'rgba(128,128,128,0.08)')}>Total leads</SortTh>
                  <SortTh col="activeQl" sort={sort} setSort={setSort} style={thStyle('activeQl', 'rgba(128,128,128,0.08)')}>QL Actual</SortTh>
                  <SortTh col="activeShowings" sort={sort} setSort={setSort} style={thStyle('activeShowings', 'rgba(128,128,128,0.08)')}>Показ+</SortTh>
                  <SortTh col="activeReanimation" sort={sort} setSort={setSort} style={thStyle('activeReanimation', 'rgba(128,128,128,0.08)')}>Реанимация</SortTh>
                  <th style={{ minWidth: '150px', background: 'rgba(128,128,128,0.08)' }}>Просроченых задач</th>
                  <SortTh col="missed" sort={sort} setSort={setSort} style={thStyle('missed', 'rgba(128,128,128,0.08)')}>Упущено</SortTh>
                  <SortTh col="allTotal" sort={sort} setSort={setSort} style={thStyle('allTotal', 'rgba(128,128,128,0.15)')}>Total leads</SortTh>
                  <SortTh col="allQl" sort={sort} setSort={setSort} style={thStyle('allQl', 'rgba(128,128,128,0.15)')}>QL Leads</SortTh>
                  <SortTh col="allCrQl" sort={sort} setSort={setSort} style={{ minWidth: '120px', background: 'rgba(128,128,128,0.15)' }}>CR Lead - QL</SortTh>
                  <SortTh col="allShowings" sort={sort} setSort={setSort} style={thStyle('allShowings', 'rgba(128,128,128,0.15)')}>Показ+</SortTh>
                  <SortTh col="allCrShowing" sort={sort} setSort={setSort} style={{ minWidth: '120px', background: 'rgba(128,128,128,0.15)' }}>CR Lead - Показ</SortTh>
                  <SortTh col="allDeals" sort={sort} setSort={setSort} style={thStyle('allDeals', 'rgba(128,128,128,0.15)')}>Сделка</SortTh>
                </tr>
              </thead>
              <tbody>
                {sourceAgg.length === 0 ? (
                  <tr>
                    <td className={styles.stickyCell} colSpan={21} style={{ textAlign: 'center', padding: '24px' }}>
                      Нет данных за выбранный период.
                    </td>
                  </tr>
                ) : (
                  sortRows(sourceAgg, sort, (sa, col) => getSortValue(sa.totals, col)).map((sa) => {
                    const isExpSrc = !!expandedSrc[sa.source];
                    const t = sa.totals;
                    return (
                      <React.Fragment key={sa.source}>
                        <tr style={{ cursor: 'pointer' }} onClick={() => toggleExpandedSrc(sa.source)}>
                          <td className={styles.stickyCell}>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isExpSrc ? <ChevronDown size={14} className={styles.dimmed} /> : <ChevronRight size={14} className={styles.dimmed} />}
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: SOURCE_COLORS[sa.source] || '#94a3b8', flexShrink: 0 }} />
                              {sa.source}
                            </div>
                          </td>
                          <td style={{ fontWeight: 700 }}>{t.received}</td>
                          <td>{t.prevReceived}</td>
                          <GrowthCell current={t.received} prev={t.prevReceived} />
                          <td style={{ color: 'var(--white-soft)', fontWeight: 600 }}>{t.ql}</td>
                          <td>{formatPercent(calcRate(t.ql, t.received))}</td>
                          <td>{t.showings}</td>
                          <td>{formatPercent(calcRate(t.showings, t.received))}</td>
                          <td>{t.deals}</td>
                          <td className={styles.group2Cell}>{t.activeTotal}</td>
                          <td className={styles.group2Cell} style={{ color: 'var(--white-soft)', fontWeight: 600 }}>{t.activeQl}</td>
                          <td className={styles.group2Cell}>{t.activeShowings}</td>
                          <td className={styles.group2Cell}>{t.activeReanimation || 0}</td>
                          <td className={styles.group2Cell}>—</td>
                          <td className={styles.group2Cell}>{t.missed}</td>
                          <td className={styles.group3Cell}>{t.allTotal}</td>
                          <td className={styles.group3Cell} style={{ color: 'var(--white-soft)', fontWeight: 600 }}>{t.allQl}</td>
                          <td className={styles.group3Cell}>{formatPercent(calcRate(t.allQl, t.allTotal))}</td>
                          <td className={styles.group3Cell}>{t.allShowings}</td>
                          <td className={styles.group3Cell}>{formatPercent(calcRate(t.allShowings, t.allTotal))}</td>
                          <td className={styles.group3Cell} style={{ fontWeight: 700, color: 'var(--white-soft)' }}>{t.allDeals}</td>
                        </tr>
                        {isExpSrc &&
                          sortRows(sa.brokers, sort, getSortValue).map((br) => (
                            <tr key={`${sa.source}-${br.id}`} className={styles.subRowCell}>
                              <td className={styles.subRowSticky}>
                                <div style={{ fontSize: '12px', color: 'var(--white-soft)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--muted)', flexShrink: 0 }} />
                                  {br.name}
                                </div>
                              </td>
                              <td>{br.received}</td>
                              <td>{br.prevReceived}</td>
                              <GrowthCell current={br.received} prev={br.prevReceived} />
                              <td>{br.ql}</td>
                              <td>{formatPercent(calcRate(br.ql, br.received))}</td>
                              <td>{br.showings}</td>
                              <td>{formatPercent(calcRate(br.showings, br.received))}</td>
                              <td>{br.deals}</td>
                              <td className={styles.group2Cell}>{br.activeTotal}</td>
                              <td className={styles.group2Cell}>{br.activeQl}</td>
                              <td className={styles.group2Cell}>{br.activeShowings}</td>
                              <td className={styles.group2Cell}>{br.activeReanimation || 0}</td>
                              <td className={styles.group2Cell}>—</td>
                              <td className={styles.group2Cell}>{br.missed}</td>
                              <td className={styles.group3Cell}>{br.allTotal}</td>
                              <td className={styles.group3Cell}>{br.allQl}</td>
                              <td className={styles.group3Cell}>{formatPercent(calcRate(br.allQl, br.allTotal))}</td>
                              <td className={styles.group3Cell}>{br.allShowings}</td>
                              <td className={styles.group3Cell}>{formatPercent(calcRate(br.allShowings, br.allTotal))}</td>
                              <td className={styles.group3Cell}>{br.allDeals}</td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default function PlanFactUI({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedSrc, setExpandedSrc] = useState<Record<string, boolean>>({});
  const [expandedP, setExpandedP] = useState<Record<string, boolean>>({});
  const [expandedSrcP, setExpandedSrcP] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [brokers, setBrokers] = useState<BrokerRow[]>([]);
  const [partners, setPartners] = useState<BrokerRow[]>([]);

  // Sort state for OP broker tables and partner tables
  const [sortOp, setSortOp] = useState<SortState>({ col: null, dir: 'desc' });
  const [sortPartner, setSortPartner] = useState<SortState>({ col: null, dir: 'desc' });

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({ startDate, endDate });
        const res = await fetch(`/api/sales/plan-fact?${params.toString()}`, { cache: 'no-store' });
        const json = (await res.json()) as PlanFactResponse;

        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to fetch plan/fact data');
        }

        if (!alive) return;
        setKpis(json.kpis || []);
        setBrokers(json.brokers || []);
        setPartners(json.partners || []);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Unexpected error');
        setKpis([]);
        setBrokers([]);
        setPartners([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [startDate, endDate]);

  const visibleKpis = useMemo(() => {
    if (kpis.length) return kpis;
    return [
      { label: 'ЛИДЫ (ПЛАН / ФАКТ)', actual: 0, plan: 100, suffix: '' },
      { label: 'QL LEADS (ПЛАН / ФАКТ)', actual: 0, plan: 50, suffix: '' },
      { label: 'ВЫРУЧКА (ПЛАН / ФАКТ)', actual: 0, plan: 300000, suffix: ' AED' },
      { label: 'СДЕЛКИ (ПЛАН / ФАКТ)', actual: 0, plan: 10, suffix: '' },
    ];
  }, [kpis]);

  if (loading && brokers.length === 0 && !error) {
    return <PlanFactSkeleton />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.summaryGrid}>
        {visibleKpis.map((k) => (
          <div key={k.label} className={styles.kpiCard} style={{ height: '140px' }}>
            <div className={styles.kpiTitle}>{k.label}</div>
            <div className={styles.kpiMainValue}>
              <span className={styles.actualValue} style={{ color: 'var(--white-soft)' }}>
                {formatNumber(k.plan)}
                <span style={{ fontSize: '12px', marginLeft: '2px' }}>{k.suffix}</span>
              </span>
              <span className={styles.planValue}>
                / {formatNumber(k.actual)}
                {k.suffix}
              </span>
            </div>
            <PlanProgress actual={k.actual} plan={k.plan} />
          </div>
        ))}
      </div>

      {error ? <div className={styles.error}>Ошибка: {error}</div> : null}

      {/* ОП (Sales Department) tables */}
      <BrokerTable
        rows={brokers}
        title="Эффективность брокеров и сравнение периодов"
        icon={<Activity size={14} />}
        expanded={expanded}
        toggleExpanded={(n) => setExpanded((p) => ({ ...p, [n]: !p[n] }))}
        expandedSrc={expandedSrc}
        toggleExpandedSrc={(n) => setExpandedSrc((p) => ({ ...p, [n]: !p[n] }))}
        sort={sortOp}
        setSort={setSortOp}
      />

      {/* Partners (Внутренний партнер) table */}
      {partners.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <BrokerTable
            rows={partners}
            title="Партнеры (Внутренний партнер)"
            icon={<Users size={14} />}
            expanded={expandedP}
            toggleExpanded={(n) => setExpandedP((p) => ({ ...p, [n]: !p[n] }))}
            expandedSrc={expandedSrcP}
            toggleExpandedSrc={(n) => setExpandedSrcP((p) => ({ ...p, [n]: !p[n] }))}
            sort={sortPartner}
            setSort={setSortPartner}
          />
        </div>
      )}
    </div>
  );
}

