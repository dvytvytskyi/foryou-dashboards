'use client';

import React, { useState, useEffect } from 'react';
import styles from '../sales.module.css';
import { 
  ChevronRight, 
  ChevronDown, 
  ExternalLink, 
  AlertCircle,
  Phone,
  Loader
} from 'lucide-react';
import { formatCompactNumber, formatPercent } from '@/lib/formatters';

interface BrokersUIProps {
  selectedBroker: { value: string; label: string; id: number } | null;
  startDate: string;
  endDate: string;
}

type OverdueTask = {
  task_id: number;
  lead_id: number;
  task_text: string;
  complete_till_unix: number;
  days_overdue: number;
};

type SourceMetrics = {
  total_leads: number;
  ql_leads: number;
  showing_leads: number;
  won_leads: number;
  lost_leads: number;
  total_price: number;
  cr_lead_to_ql: number;
  cr_lead_to_showing: number;
  active_total_leads: number;
  active_ql_leads: number;
  active_showing_leads: number;
  overdue_tasks: number;
};

type PeriodMetrics = {
  total_leads: number;
  ql_leads: number;
  showing_leads: number;
  won_leads: number;
  revenue: number;
  lost_leads: number;
  by_source: Record<string, SourceMetrics>;
};

type BrokerMetrics = {
  broker_name: string;
  broker_id: number;
  by_source: Record<string, SourceMetrics>;
  period_data: {
    current: PeriodMetrics;
    previous: PeriodMetrics;
    comparison_percent: number;
  };
  totals: {
    leads: number;
    ql_leads: number;
    showing_leads: number;
    won_leads: number;
    revenue: number;
    lost_leads: number;
  };
  plan: {
    lids: number;
    ql: number;
    revenue: number;
    deals: number;
  };
  overdue_tasks: OverdueTask[];
};

const SOURCE_COLORS: Record<string, string> = {
  'Red': '#6366f1',
  'Property Finder': '#8b5cf6',
  'Primary Plus': '#f97316',
  'Klykov': '#10b981',
  'Oman': '#f59e0b',
  'Facebook': '#3b82f6',
  'Partners leads': '#ec4899',
  'Own leads': '#94a3b8',
};

const SOURCE_ORDER = ['Red', 'Primary Plus', 'Property Finder', 'Klykov', 'Oman', 'Facebook', 'Partners leads', 'Own leads'];

function PlanProgress({ actual, plan, label = 'ВЫПОЛНЕНИЕ' }: { actual: number, plan: number, label?: string }) {
  const percent = plan > 0 ? Math.round((actual / plan) * 100) : 0;
  const color = percent >= 60 ? '#10b981' : percent >= 40 ? '#f59e0b' : '#f43f5e';
  
  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '6px' }}>
        <span style={{ color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ color: color, fontWeight: 700 }}>{percent}%</span>
      </div>
      <div className={styles.barChartTrack} style={{ height: '4px', background: 'rgba(255,255,255,0.05)' }}>
        <div 
          className={styles.barChartFill} 
          style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }} 
        />
      </div>
    </div>
  );
}

function formatDate(unix: number): string {
  if (!unix) return '-';
  const date = new Date(unix * 1000);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function comparisonPercent(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function BrokersSkeleton() {
  return (
    <div className={styles.container} style={{ padding: '0 32px 32px 32px' }}>
      <div className={styles.kpiGrid} style={{ marginTop: '24px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`${styles.skeletonCard} ${styles.skeleton}`} />
        ))}
      </div>
      
      <div className={styles.skeletonBlock} style={{ marginTop: '16px' }}>
        <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`${styles.skeleton} ${styles.skeletonRow}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BrokersUI({ selectedBroker, startDate, endDate }: BrokersUIProps) {
  const [metrics, setMetrics] = useState<BrokerMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedWork, setExpandedWork] = useState<Record<string, boolean>>({ main: true });
  const [expandedLifetime, setExpandedLifetime] = useState<Record<string, boolean>>({ life: true });

  useEffect(() => {
    if (!selectedBroker?.id) return;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/sales/brokers?brokerId=${selectedBroker.id}&brokerName=${encodeURIComponent(selectedBroker.label)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
        );
        const data = await res.json();
        setMetrics(data);
      } catch (err) {
        console.error('Failed to fetch broker metrics:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedBroker?.id, selectedBroker?.label, startDate, endDate]);

  if (!selectedBroker) {
    return (
      <div className={styles.container} style={{ padding: '0 32px 32px 32px' }}>
        <div style={{ 
          height: '400px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--muted)',
          fontSize: '14px',
          border: '1px dashed var(--line-soft)',
          borderRadius: '12px',
          marginTop: '24px'
        }}>
          Выберите брокера для просмотра детальной аналитики
        </div>
      </div>
    );
  }

  if (loading) {
    return <BrokersSkeleton />;
  }

  if (!metrics) {
    return (
      <div className={styles.container} style={{ padding: '0 32px 32px 32px' }}>
        <div style={{ 
          height: '400px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--muted)',
          fontSize: '14px',
        }}>
          Нет данных для этого брокера
        </div>
      </div>
    );
  }

  const toggleWork = (id: string) => setExpandedWork(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleLifetime = (id: string) => setExpandedLifetime(prev => ({ ...prev, [id]: !prev[id] }));

  const sources = Object.keys(metrics.by_source).filter(s => SOURCE_ORDER.includes(s)).sort((a, b) => SOURCE_ORDER.indexOf(a) - SOURCE_ORDER.indexOf(b));
  const activeTotalLeads = Object.values(metrics.by_source).reduce((sum, s) => sum + (s.active_total_leads || 0), 0);
  const activeQlLeads = Object.values(metrics.by_source).reduce((sum, s) => sum + (s.active_ql_leads || 0), 0);
  const activeShowingLeads = Object.values(metrics.by_source).reduce((sum, s) => sum + (s.active_showing_leads || 0), 0);

  return (
    <div className={styles.container} style={{ padding: '0 32px 32px 32px' }}>
      
      {/* KPI Scorecards */}
      <div className={styles.kpiGrid} style={{ marginTop: '24px' }}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>ЛИДЫ (ПЛАН / ФАКТ)</div>
          <div className={styles.kpiValue}>{metrics.totals.leads} <span style={{ color: 'var(--muted)', fontSize: '16px' }}>/ {metrics.plan.lids}</span></div>
          <PlanProgress actual={metrics.totals.leads} plan={metrics.plan.lids} />
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>QL LEADS (ПЛАН / ФАКТ)</div>
          <div className={styles.kpiValue}>{metrics.totals.ql_leads} <span style={{ color: 'var(--muted)', fontSize: '16px' }}>/ {metrics.plan.ql}</span></div>
          <PlanProgress actual={metrics.totals.ql_leads} plan={metrics.plan.ql} />
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>ВЫРУЧКА (ПЛАН / ФАКТ)</div>
          <div className={styles.kpiValue}>{formatCompactNumber(metrics.totals.revenue)} <span style={{ color: 'var(--muted)', fontSize: '14px' }}>/ {formatCompactNumber(metrics.plan.revenue)} AED</span></div>
          <PlanProgress actual={metrics.totals.revenue} plan={metrics.plan.revenue} />
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>СДЕЛКИ (ПЛАН / ФАКТ)</div>
          <div className={styles.kpiValue}>{metrics.totals.won_leads} <span style={{ color: 'var(--muted)', fontSize: '16px' }}>/ {metrics.plan.deals}</span></div>
          <PlanProgress actual={metrics.totals.won_leads} plan={metrics.plan.deals} />
        </div>
      </div>

      {/* Table 1: Что сейчас в работе */}
      <div className={styles.section} style={{ marginTop: '16px' }}>
        <div className={styles.sectionTitle}>Что сейчас в работе</div>
        <div className={styles.tableWrapper}>
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.workTable}`}>
              <thead>
                <tr>
                  <th rowSpan={2} className={styles.stickyCell} style={{ minWidth: '180px' }}>ФИО брокера</th>
                  <th rowSpan={2}>Всего получил</th>
                  <th rowSpan={2}>Всего получил</th>
                  <th rowSpan={2}>Сравнение с прошлым периодом</th>
                  <th rowSpan={2}>QL leads</th>
                  <th rowSpan={2}>CR Lead - QL</th>
                  <th rowSpan={2}>ПП/Показ+</th>
                  <th rowSpan={2}>CR Lead - Показ</th>
                  <th rowSpan={2}>Сделка</th>
                  <th colSpan={5}>Что сейчас в работе</th>
                </tr>
                <tr>
                  <th>Total leads</th>
                  <th>QL Leads</th>
                  <th>Показ+</th>
                  <th>Просроченых задач</th>
                  <th>Упущено</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ cursor: 'pointer' }} onClick={() => toggleWork('main')}>
                  <td className={styles.stickyCell}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {expandedWork['main'] ? <ChevronDown size={14} className={styles.dimmed} /> : <ChevronRight size={14} className={styles.dimmed} />}
                      {selectedBroker.label}
                    </div>
                  </td>
                  <td>{metrics.period_data.current.total_leads}</td>
                  <td>{metrics.period_data.previous.total_leads}</td>
                  <td>{formatPercent(comparisonPercent(metrics.period_data.current.total_leads, metrics.period_data.previous.total_leads), 0)}</td>
                  <td>{metrics.period_data.current.ql_leads}</td>
                  <td>{formatPercent(metrics.period_data.current.total_leads > 0 ? (metrics.period_data.current.ql_leads / metrics.period_data.current.total_leads) * 100 : 0)}</td>
                  <td>{metrics.period_data.current.showing_leads}</td>
                  <td>{formatPercent(metrics.period_data.current.total_leads > 0 ? (metrics.period_data.current.showing_leads / metrics.period_data.current.total_leads) * 100 : 0)}</td>
                  <td>{metrics.period_data.current.won_leads}</td>
                  <td>{activeTotalLeads}</td>
                  <td>{activeQlLeads}</td>
                  <td>{activeShowingLeads}</td>
                  <td style={{ color: '#f43f5e', fontWeight: 700 }}>{metrics.overdue_tasks.length}</td>
                  <td>{metrics.period_data.current.lost_leads}</td>
                </tr>
                {expandedWork['main'] && sources.map(source => {
                  const data = metrics.by_source[source];
                  const periodCurrent = metrics.period_data.current.by_source[source];
                  const periodPrevious = metrics.period_data.previous.by_source[source];
                  const srcCurrent = periodCurrent?.total_leads || 0;
                  const srcPrevious = periodPrevious?.total_leads || 0;
                  const srcComparison = comparisonPercent(srcCurrent, srcPrevious);
                  if (!data) return null;
                  return (
                    <tr key={source} className={styles.subRowCell}>
                      <td className={styles.subRowSticky}>
                        <div style={{ fontSize: '12px', color: 'var(--white-soft)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: SOURCE_COLORS[source] || '#94a3b8' }} />
                          {source}
                        </div>
                      </td>
                      <td>{srcCurrent}</td>
                      <td>{srcPrevious}</td>
                      <td>{formatPercent(srcComparison, 0)}</td>
                      <td>{periodCurrent?.ql_leads || 0}</td>
                      <td>{formatPercent(periodCurrent?.cr_lead_to_ql || 0)}</td>
                      <td>{periodCurrent?.showing_leads || 0}</td>
                      <td>{formatPercent(periodCurrent?.cr_lead_to_showing || 0)}</td>
                      <td>{periodCurrent?.won_leads || 0}</td>
                      <td>{data.active_total_leads || 0}</td>
                      <td>{data.active_ql_leads || 0}</td>
                      <td>{data.active_showing_leads || 0}</td>
                      <td style={{ color: '#f43f5e' }}>{data.overdue_tasks || 0}</td>
                      <td>{periodCurrent?.lost_leads || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Table 2: Lifetime Performance */}
      <div className={styles.section} style={{ marginTop: '16px' }}>
        <div className={styles.sectionTitle}>В целом за весь срок работы</div>
        <div className={styles.tableWrapper}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.stickyCell} style={{ minWidth: '180px' }}>ФИО брокера</th>
                  <th>Total leads</th>
                  <th>Закрыто и не реализовано</th>
                  <th>QL Leads</th>
                  <th>CR Lead - QL</th>
                  <th>Показ+</th>
                  <th>CR Lead - Показ</th>
                  <th>Сделка</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ cursor: 'pointer' }} onClick={() => toggleLifetime('total')}>
                  <td className={styles.stickyCell}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {expandedLifetime['total'] ? <ChevronDown size={14} className={styles.dimmed} /> : <ChevronRight size={14} className={styles.dimmed} />}
                      <span>{selectedBroker.label}</span>
                    </div>
                  </td>
                  <td>{metrics.totals.leads}</td>
                  <td>{metrics.totals.lost_leads}</td>
                  <td>{metrics.totals.ql_leads}</td>
                  <td>{metrics.totals.leads > 0 ? ((metrics.totals.ql_leads / metrics.totals.leads) * 100).toFixed(2) : 0}%</td>
                  <td>{metrics.totals.showing_leads}</td>
                  <td>{metrics.totals.leads > 0 ? ((metrics.totals.showing_leads / metrics.totals.leads) * 100).toFixed(2) : 0}%</td>
                  <td>{metrics.totals.won_leads}</td>
                </tr>
                {expandedLifetime['total'] && sources.map(source => {
                  const data = metrics.by_source[source];
                  if (!data) return null;
                  return (
                    <tr key={source} className={styles.subRowCell}>
                      <td className={styles.subRowSticky}>
                        <div style={{ fontSize: '12px', color: 'var(--white-soft)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: SOURCE_COLORS[source] || '#94a3b8' }} />
                          {source}
                        </div>
                      </td>
                      <td>{data.total_leads}</td>
                      <td>-</td>
                      <td>{data.ql_leads}</td>
                      <td>{data.cr_lead_to_ql.toFixed(2)}%</td>
                      <td>{data.showing_leads}</td>
                      <td>{data.cr_lead_to_showing.toFixed(2)}%</td>
                      <td>{data.won_leads}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Table 3: Overdue Tasks */}
      {metrics.overdue_tasks && metrics.overdue_tasks.length > 0 && (
        <div className={styles.section} style={{ marginTop: '16px', marginBottom: '32px' }}>
          <div className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            Просроченные задачи 
            <span style={{ background: '#f43f5e', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
              {metrics.overdue_tasks.length} штук
            </span>
          </div>
          <div className={styles.tableWrapper}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Лид (AmoCRM)</th>
                    <th>ID</th>
                    <th>Дата задачи</th>
                    <th>Дней просрочено</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.overdue_tasks.map((task) => (
                    <tr key={task.task_id}>
                      <td>
                        <a 
                          href={`https://reforyou.amocrm.ru/leads/detail/${task.lead_id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                          Лид #{task.lead_id} <ExternalLink size={12} />
                        </a>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--muted)' }}>{task.lead_id}</td>
                      <td style={{ fontSize: '11px' }}>{formatDate(task.complete_till_unix)}</td>
                      <td style={{ color: '#f43f5e', fontWeight: 700 }}>
                        <span style={{ fontSize: '12px' }}>{task.days_overdue}d</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
