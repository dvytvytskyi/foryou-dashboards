'use client';

import React, { useEffect, useMemo, useState } from 'react';
import styles from './plan-fact.module.css';
import { BarChart3, ChevronDown, ChevronRight, Target, Trophy, Activity } from 'lucide-react';
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

export default function PlanFactUI({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [brokers, setBrokers] = useState<BrokerRow[]>([]);

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
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Unexpected error');
        setKpis([]);
        setBrokers([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
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

  const toggleExpanded = (name: string) => {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  };

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
                {formatNumber(k.actual)}
                <span style={{ fontSize: '12px', marginLeft: '2px' }}>{k.suffix}</span>
              </span>
              <span className={styles.planValue}>
                / {formatNumber(k.plan)}
                {k.suffix}
              </span>
            </div>
            <PlanProgress actual={k.actual} plan={k.plan} />
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <Activity size={14} />
            <span>Эффективность брокеров и сравнение периодов</span>
          </div>
        </div>

        {error ? <div className={styles.error}>Ошибка: {error}</div> : null}

        <div className={styles.tableWrapper} style={{ overflowX: 'auto' }}>
          <div className={styles.tableScroll} style={{ maxHeight: 'none' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className={styles.stickyCell}
                    style={{
                      minWidth: '220px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Trophy size={14} />
                      <span>ФИО брокера</span>
                    </div>
                  </th>
                  <th colSpan={8} style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', background: 'var(--bg-0)', padding: '12px' }}>
                    &nbsp;
                  </th>
                  <th
                    colSpan={5}
                    className={styles.group2Cell}
                    style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', color: 'var(--white-soft)', padding: '12px' }}
                  >
                    ЧТО СЕЙЧАС В РАБОТЕ
                  </th>
                  <th
                    colSpan={7}
                    className={styles.group3Cell}
                    style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', color: 'var(--white-soft)', padding: '12px' }}
                  >
                    В ЦЕЛОМ ЗА ВЕСЬ СРОК РАБОТЫ
                  </th>
                </tr>
                <tr>
                  <th style={{ minWidth: '100px', background: 'var(--panel-2)' }}>Всего получил</th>
                  <th style={{ minWidth: '120px', background: 'var(--panel-2)' }}>Всего получил (прош.)</th>
                  <th style={{ minWidth: '150px', background: 'var(--panel-2)' }}>Сравнение</th>
                  <th style={{ minWidth: '100px', background: 'var(--panel-2)' }}>QL leads</th>
                  <th style={{ minWidth: '120px', background: 'var(--panel-2)' }}>CR Lead - QL</th>
                  <th style={{ minWidth: '100px', background: 'var(--panel-2)' }}>ПП/Показ+</th>
                  <th style={{ minWidth: '120px', background: 'var(--panel-2)' }}>CR Lead - Показ</th>
                  <th style={{ minWidth: '80px', background: 'var(--panel-2)' }}>Сделка</th>

                  <th style={{ minWidth: '100px', background: 'rgba(128, 128, 128, 0.08)' }}>Total leads</th>
                  <th style={{ minWidth: '100px', background: 'rgba(128, 128, 128, 0.08)' }}>QL Leads</th>
                  <th style={{ minWidth: '100px', background: 'rgba(128, 128, 128, 0.08)' }}>Показ+</th>
                  <th style={{ minWidth: '150px', background: 'rgba(128, 128, 128, 0.08)' }}>Просроченых задач</th>
                  <th style={{ minWidth: '100px', background: 'rgba(128, 128, 128, 0.08)' }}>Упущено</th>

                  <th style={{ minWidth: '100px', background: 'rgba(128, 128, 128, 0.15)' }}>Total leads</th>
                  <th style={{ minWidth: '180px', background: 'rgba(128, 128, 128, 0.15)' }}>Закрыто и не реализовано</th>
                  <th style={{ minWidth: '100px', background: 'rgba(128, 128, 128, 0.15)' }}>QL Leads</th>
                  <th style={{ minWidth: '120px', background: 'rgba(128, 128, 128, 0.15)' }}>CR Lead - QL</th>
                  <th style={{ minWidth: '100px', background: 'rgba(128, 128, 128, 0.15)' }}>Показ+</th>
                  <th style={{ minWidth: '120px', background: 'rgba(128, 128, 128, 0.15)' }}>CR Lead - Показ</th>
                  <th style={{ minWidth: '80px', background: 'rgba(128, 128, 128, 0.15)' }}>Сделка</th>
                </tr>
              </thead>

              <tbody>
                {brokers.length === 0 ? (
                  <tr>
                    <td className={styles.stickyCell} colSpan={21} style={{ textAlign: 'center', padding: '24px' }}>
                      Нет данных за выбранный период.
                    </td>
                  </tr>
                ) : (
                  brokers.map((b) => {
                    const isExpanded = !!expanded[b.name];
                    const brokerGrowth = growth(b.received, b.prevReceived);

                    return (
                      <React.Fragment key={b.id}>
                        <tr style={{ cursor: 'pointer' }} onClick={() => toggleExpanded(b.name)}>
                          <td className={styles.stickyCell}>
                            <div
                              style={{ 
                                fontWeight: 600, 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px'
                              }}
                            >
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
                          <td className={styles.group2Cell} style={{ color: 'var(--white-soft)', fontWeight: 600 }}>
                            {b.activeQl}
                          </td>
                          <td className={styles.group2Cell}>{b.activeShowings}</td>
                          <td className={styles.group2Cell} style={{ color: b.overdue > 0 ? '#f43f5e' : 'inherit' }}>
                            {b.overdue}
                          </td>
                          <td className={styles.group2Cell}>{b.missed}</td>

                          <td className={styles.group3Cell}>{b.allTotal}</td>
                          <td className={styles.group3Cell}>{b.allLost}</td>
                          <td className={styles.group3Cell} style={{ color: 'var(--white-soft)', fontWeight: 600 }}>
                            {b.allQl}
                          </td>
                          <td className={styles.group3Cell}>{formatPercent(calcRate(b.allQl, b.allTotal))}</td>
                          <td className={styles.group3Cell}>{b.allShowings}</td>
                          <td className={styles.group3Cell}>{formatPercent(calcRate(b.allShowings, b.allTotal))}</td>
                          <td className={styles.group3Cell} style={{ fontWeight: 700, color: 'var(--white-soft)' }}>
                            {b.allDeals}
                          </td>
                        </tr>

                        {isExpanded &&
                          b.sourceRows.map((s) => {
                            return (
                              <tr key={`${b.id}-${s.source}`} className={styles.subRowCell}>
                                <td className={styles.subRowSticky}>
                                  <div
                                    style={{
                                      fontSize: '12px',
                                      color: 'var(--white-soft)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        background: SOURCE_COLORS[s.source] || '#94a3b8',
                                      }}
                                    />
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
                                <td className={styles.group2Cell}>0</td>
                                <td className={styles.group2Cell}>{s.missed}</td>

                                <td className={styles.group3Cell}>{s.allTotal}</td>
                                <td className={styles.group3Cell}>{s.allLost}</td>
                                <td className={styles.group3Cell}>{s.allQl}</td>
                                <td className={styles.group3Cell}>{formatPercent(calcRate(s.allQl, s.allTotal))}</td>
                                <td className={styles.group3Cell}>{s.allShowings}</td>
                                <td className={styles.group3Cell}>{formatPercent(calcRate(s.allShowings, s.allTotal))}</td>
                                <td className={styles.group3Cell}>{s.allDeals}</td>
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
