'use client';

import React from 'react';
import styles from './sales.module.css';
import { ArrowUpRight, ArrowDownRight, Info, User, Search, X, Filter, PieChart, Trophy, TrendingUp, HeartHandshake, Briefcase } from 'lucide-react';

const RATE = 3.673;

const formatMoney = (v: number, currency: string = 'aed') => {
  const amount = currency === 'usd' ? v / RATE : v;
  const rounded = Math.round(amount);
  const formatted = rounded.toLocaleString();
  return currency === 'usd' ? `$${formatted}` : `${formatted} AED`;
};

const formatNum = (v: number) => v.toLocaleString();
const formatPct = (v: number) => `${(v * 100).toFixed(2)}%`;

function DynamicTag({ label, value, up }: { label: string, value: string, up?: boolean }) {
  return (
    <div className={`${styles.dynamicTag} ${up ? styles.tagUp : styles.tagDown}`}>
      <span className={styles.tagLabel}>{label}</span>
      <span className={styles.tagValue}>
        {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
        {value}
      </span>
    </div>
  );
}

export function SalesScoreboard({ data, currency, onClick }: { data: any, currency: string, onClick: (metric: string) => void }) {
  const kpis = [
    { id: 'COUNT', label: 'КОЛИЧЕСТВО СДЕЛОК', value: formatNum(data.closed_deals || 0), dynamics: [{ label: 'mom', value: '5%', up: true }, { label: 'qoq', value: '12%', up: true }, { label: 'yoy', value: '2%', up: false }] },
    { id: 'GMV', label: 'СУММА СДЕЛОК (GMV)', value: formatMoney(data.gmv || 0, currency), dynamics: [{ label: 'mom', value: '8.4%', up: true }, { label: 'qoq', value: '22%', up: true }, { label: 'yoy', value: '45%', up: true }] },
    { id: 'GROSS', label: 'ВАЛОВАЯ КОМИССИЯ', value: formatMoney(data.gross_commission || 0, currency), dynamics: [{ label: 'mom', value: '3.1%', up: true }, { label: 'qoq', value: '15.4%', up: true }, { label: 'yoy', value: '18%', up: true }] },
    { id: 'NET', label: 'ДОХОД КОМПАНИИ (NET)', value: formatMoney(data.net_profit || 0, currency), dynamics: [{ label: 'mom', value: '1.2%', up: true }, { label: 'qoq', value: '8.9%', up: true }, { label: 'yoy', value: '11.2%', up: true }] },
  ];

  return (
    <div className={styles.kpiGrid}>
      {kpis.map((c) => (
        <div key={c.label} className={styles.kpiCard} style={{ cursor: 'pointer' }} onClick={() => onClick(c.id)}>
          <div className={styles.kpiLabel}>{c.label}</div>
          <div className={styles.kpiValue}>{c.value}</div>
          <div className={styles.dynamicsRow}>
            {c.dynamics.map(d => (
              <DynamicTag key={d.label} label={d.label} value={d.value} up={d.up} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DealsModal({ isOpen, onClose, deals, currency, highlightMetric }: { isOpen: boolean, onClose: () => void, deals: any[], currency: string, highlightMetric?: string | null }) {
  const [typeFilter, setTypeFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');

  if (!isOpen) return null;

  const filtered = deals.filter(d => {
    const matchesType = typeFilter === 'ALL' || d.type === typeFilter;
    const broker = (d.broker || '').toLowerCase();
    const matchesSearch = broker.includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const types = ['ALL', 'Offplan', 'Вторичка', 'Аренда', 'Сопровождение'];

  const getColStyle = (metricId: string) => {
    if (highlightMetric === metricId) {
      return { backgroundColor: 'rgba(255, 255, 255, 0.04)' };
    }
    return {};
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Детализация сделок</div>
          <button className={styles.closeButton} onClick={onClose}><X size={18} /></button>
        </div>
        
        <div className={styles.modalFilters}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>ТИП СДЕЛКИ:</span>
            <div className={styles.dynamicsRow}>
              {types.map(t => (
                <button 
                  key={t}
                  className={styles.dynamicTag} 
                  style={{ 
                    cursor: 'pointer', 
                    background: typeFilter === t ? 'var(--white-soft)' : 'var(--surface-input)',
                    color: typeFilter === t ? 'var(--bg-0)' : 'var(--muted)'
                  }}
                  onClick={() => setTypeFilter(t)}
                >
                  <span className={styles.tagLabel} style={{ color: 'inherit' }}>{t}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.searchWrapper}>
            <Search size={14} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Поиск по брокеру или объекту..." 
              className={styles.tableSearch}
              style={{ width: '300px' }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.modalBody}>
          <table className={styles.modalTable}>
            <thead>
              <tr>
                <th style={getColStyle('COUNT')}>ДАТА</th>
                <th style={getColStyle('COUNT')}>БРОКЕР</th>
                <th>ОБЪЕКТ / ОПИСАНИЕ</th>
                <th>ТИП</th>
                <th className={styles.numCell} style={getColStyle('GMV')}>GMV</th>
                <th className={styles.numCell} style={getColStyle('GROSS')}>ГРОСС</th>
                <th className={styles.numCell} style={getColStyle('NET')}>ЧИСТАЯ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr key={d.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{d.date}</td>
                  <td style={{ fontWeight: 600 }}>{d.broker}</td>
                  <td style={{ color: 'var(--muted)', fontSize: '11px' }}>{d.info}</td>
                  <td>
                    <span className={styles.typeBadge} style={{ 
                      backgroundColor: 'var(--bg-0)',
                      border: '1px solid var(--line)',
                      color: 'var(--white-soft)'
                    }}>
                      {d.type}
                    </span>
                  </td>
                  <td className={styles.numCell}>{formatMoney(d.gmv, currency)}</td>
                  <td className={styles.numCell}>{formatMoney(d.gross, currency)}</td>
                  <td className={styles.numCell} style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatMoney(d.net, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function DealTypeStackedBar({ data }: { data: any[] }) {
  const types = data && data.length > 0 ? data : [{ label: 'Нет данных', value: 100, color: 'var(--line-soft)' }];
  
  // Calculate conic gradient parts
  let currentPct = 0;
  const gradientParts = types.map(t => {
    const start = currentPct;
    currentPct += t.value;
    return `${t.color || 'var(--muted)'} ${start}% ${currentPct}%`;
  }).join(', ');

  const totalDeals = types.reduce((acc, t) => acc + (t.rawCount || 0), 0);

  return (
    <div className={styles.section} style={{ padding: 0 }}>
      <div className={styles.sectionTitle} style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PieChart size={14} />
          <span>Распределение по типам</span>
        </div>
      </div>
      <div className={styles.distributionContainer} style={{ padding: '18px' }}>
        <div className={styles.donutWrapper}>
          <div className={styles.donut} style={{ background: `conic-gradient(${gradientParts})` }}>
            <div className={styles.donutCenter}>
            </div>
          </div>
        </div>
        <div className={styles.legendGrid}>
          {types.map((t) => (
            <div key={t.label} className={styles.legendItemExtended}>
              <div className={styles.legendItem}>
                <div className={styles.legendDot} style={{ backgroundColor: t.color || 'var(--muted)' }} />
                <span className={styles.legendLabel}>{t.label}</span>
              </div>
              <span className={styles.legendValue} style={{ fontWeight: 700 }}>{t.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DepartmentBreakdown({ data, currency }: { data: any[], currency: string }) {
  const depts = data && data.length > 0 ? data : [
    { label: 'Прямые продажи', value: 0, share: 0, color: 'var(--white-soft)' },
    { label: 'Партнеры', value: 0, share: 0, color: 'var(--muted)' },
  ];

  const minVal = Math.min(...depts.map((d) => d.value || 0), 0);
  const maxVal = Math.max(...depts.map((d) => d.value || 0), 0);
  const range = Math.max(1, maxVal - minVal);
  const zeroPos = ((0 - minVal) / range) * 100;

  const barStyle = (value: number) => {
    if (value >= 0) {
      return {
        left: `${zeroPos}%`,
        width: `${Math.max(0, (value / range) * 100)}%`,
        background: 'linear-gradient(90deg, rgba(16,185,129,0.55) 0%, rgba(16,185,129,0.95) 100%)',
      };
    }
    return {
      left: `${zeroPos + (value / range) * 100}%`,
      width: `${Math.max(0, (-value / range) * 100)}%`,
      background: 'linear-gradient(90deg, rgba(244,63,94,0.95) 0%, rgba(244,63,94,0.55) 100%)',
    };
  };

  return (
    <div className={styles.section} style={{ padding: 0 }}>
      <div className={styles.sectionTitle} style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={14} />
          <span>Доходность по источникам</span>
        </div>
      </div>
      <div className={styles.deptListScroll} style={{ padding: '0 18px 18px 18px' }}>
        <table className={styles.table} style={{ marginTop: '4px' }}>
          <tbody>
            {depts.map((d) => (
              <tr key={d.label}>
                <td style={{ border: 'none', padding: '10px 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span className={styles.barChartLabel}>{d.label} <span style={{ color: 'var(--muted)', fontSize: '11px', marginLeft: '4px' }}>{d.share}%</span></span>
                      <span className={styles.barChartValue}>{formatMoney(d.value, currency)}</span>
                    </div>
                    <div className={styles.barChartTrack}>
                      <div
                        style={{
                          position: 'absolute',
                          left: `${zeroPos}%`,
                          top: 0,
                          bottom: 0,
                          width: '1px',
                          background: 'rgba(255,255,255,0.18)',
                        }}
                      />
                      <div 
                        className={styles.barChartFill} 
                        style={barStyle(d.value || 0)}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SupportSection({ data, currency }: { data: any[], currency: string }) {
  const managers = data && data.length > 0 ? data : [{ name: 'Крис', deals: 0, revenue: 0, color: '#6366f1' }, { name: 'Яна', deals: 0, revenue: 0, color: '#ec4899' }];
  return (
    <div className={styles.section} style={{ padding: 0 }}>
      <div className={styles.sectionTitle} style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HeartHandshake size={14} />
          <span>Сопровождение</span>
        </div>
      </div>
      <div className={styles.supportGrid} style={{ padding: '18px' }}>
        {managers.map((m) => (
          <div key={m.name} className={styles.supportCard}>
            <div className={styles.supportHeader}>
              <div className={styles.supportAvatar} style={{ backgroundColor: `${m.color}15`, color: m.color }}>{m.name[0]}</div>
              <div className={styles.supportName}>{m.name}</div>
            </div>
            <div className={styles.supportMetrics}>
              <div className={styles.supportMetric}><span className={styles.smLabel}>Сделок</span><span className={styles.smValue}>{m.deals}</span></div>
              <div className={styles.supportMetric}><span className={styles.smLabel}>Сумма сопровожд.</span><span className={styles.smValue}>{formatMoney(m.fee || 0, currency)}</span></div>
              <div className={styles.supportMetric}><span className={styles.smLabel}>Доход компании</span><span className={styles.smValue}>{formatMoney(m.revenue, currency)}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfitBarChart({ brokers, currency }: { brokers: any[], currency: string }) {
  const sorted = [...(brokers || [])].sort((a, b) => b.net_profit - a.net_profit);
  const minProfit = Math.min(...sorted.map((b) => b.net_profit || 0), 0);
  const maxProfit = Math.max(...sorted.map((b) => b.net_profit || 0), 0);
  const range = Math.max(1, maxProfit - minProfit);
  const zeroPos = ((0 - minProfit) / range) * 100;

  const barStyle = (value: number) => {
    if (value >= 0) {
      return {
        left: `${zeroPos}%`,
        width: `${Math.max(0, (value / range) * 100)}%`,
        background: 'linear-gradient(90deg, rgba(16,185,129,0.55) 0%, rgba(16,185,129,0.95) 100%)',
      };
    }
    return {
      left: `${zeroPos + (value / range) * 100}%`,
      width: `${Math.max(0, (-value / range) * 100)}%`,
      background: 'linear-gradient(90deg, rgba(244,63,94,0.95) 0%, rgba(244,63,94,0.55) 100%)',
    };
  };
  
  return (
    <div className={styles.section} style={{ padding: 0 }}>
      <div className={styles.sectionTitle} style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trophy size={14} />
          <span>Top по чистому доходу</span>
        </div>
      </div>
      <div className={styles.chartListScroll} style={{ padding: '0 18px 18px 18px' }}>
        <table className={styles.table} style={{ marginTop: '4px' }}>
          <tbody>
            {sorted.slice(0, 15).map((b) => (
              <tr key={b.broker_name}>
                <td style={{ border: 'none', padding: '10px 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span className={styles.barChartLabel}>{b.broker_name}</span>
                      <span className={styles.barChartValue}>{formatMoney(b.net_profit, currency)}</span>
                    </div>
                    <div className={styles.barChartTrack}>
                      <div
                        style={{
                          position: 'absolute',
                          left: `${zeroPos}%`,
                          top: 0,
                          bottom: 0,
                          width: '1px',
                          background: 'rgba(255,255,255,0.18)',
                        }}
                      />
                      <div 
                        className={styles.barChartFill} 
                        style={barStyle(b.net_profit || 0)}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BrokerKpiTable({ brokers, currency }: { brokers: any[], currency: string }) {
  const [search, setSearch] = React.useState('');
  const filtered = (brokers || []).filter(b => b.broker_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={styles.section} style={{ padding: 0 }}>
      <div className={styles.sectionTitle} style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Briefcase size={14} />
          <span>KPI брокеров</span>
        </div>
        <div className={styles.searchWrapper}>
          <Search size={14} className={styles.searchIcon} />
          <input type="text" placeholder="Поиск брокера..." className={styles.tableSearch} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className={styles.tableWrapper} style={{ padding: '0 18px 18px 18px' }}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>БРОКЕР</th>
                <th className={styles.numCell}>ГРОСС</th>
                <th className={styles.numCell}>ПРИБЫЛЬ</th>
                <th className={styles.numCell}>ПЛАН (С)</th>
                <th className={styles.numCell}>ПЛАН (Л)</th>
                <th className={styles.numCell}>ПЛАН (QL)</th>
                <th className={styles.numCell}>ПЛАН (REV)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => (
                <tr key={b.broker_name}>
                  <td><div className={styles.rank}>{i + 1}</div></td>
                  <td>{b.broker_name}</td>
                  <td className={styles.numCell}>{formatMoney(b.gross_revenue, currency)}</td>
                  <td className={styles.numCell} style={{ fontWeight: 700, color: 'var(--white-soft)' }}>{formatMoney(b.net_profit, currency)}</td>
                  <td className={styles.numCell} style={{ opacity: 0.6 }}>{b.plan_deals || '-'}</td>
                  <td className={styles.numCell} style={{ opacity: 0.6 }}>{b.plan_leads || '-'}</td>
                  <td className={styles.numCell} style={{ opacity: 0.6 }}>{b.plan_ql || '-'}</td>
                  <td className={styles.numCell} style={{ opacity: 0.6 }}>{b.plan_revenue ? formatMoney(b.plan_revenue, currency) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function PartnersTable({ partners, currency }: { partners: any[], currency: string }) {
  const [search, setSearch] = React.useState('');
  const filtered = (partners || []).filter(p => p.name?.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.revenue - a.revenue);
  
  return (
    <div className={styles.section} style={{ padding: 0 }}>
      <div className={styles.sectionTitle} style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Briefcase size={14} />
          <span>Рейтинг Партнеров</span>
        </div>
        <div className={styles.searchWrapper}>
          <Search size={14} className={styles.searchIcon} />
          <input type="text" placeholder="Поиск партнера..." className={styles.tableSearch} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className={styles.tableWrapper} style={{ padding: '0 18px 18px 18px' }}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>ПАРТНЕР</th>
                <th className={styles.numCell}>СДЕЛКИ</th>
                <th className={styles.numCell}>ПРИБЫЛЬ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.name}>
                  <td><div className={styles.rank}>{i + 1}</div></td>
                  <td>{p.name}</td>
                  <td className={styles.numCell}>{p.deals}</td>
                  <td className={styles.numCell} style={{ fontWeight: 700, color: 'var(--white-soft)' }}>{formatMoney(p.revenue, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function SalesDashboardSkeleton() {
  return (
    <div className={styles.container} style={{ padding: 0 }}>
      {/* KPI Cards Skeleton */}
      <div className={styles.kpiGrid} style={{ marginTop: '16px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`${styles.skeletonBlock} ${styles.skeletonCard} ${styles.skeleton}`} />
        ))}
      </div>

      {/* Row 1 Skeleton */}
      <div className={styles.visualsGrid} style={{ marginTop: '8px' }}>
        <div className={styles.skeletonBlock}>
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          <div className={`${styles.skeleton} ${styles.skeletonCircle}`} />
        </div>
        <div className={styles.skeletonBlock}>
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          {[1, 2, 3, 4, 5].map(i => <div key={i} className={`${styles.skeleton} ${styles.skeletonRow}`} />)}
        </div>
      </div>

      {/* Row 2 Skeleton */}
      <div className={styles.visualsGrid} style={{ marginTop: '8px' }}>
        <div className={styles.skeletonBlock}>
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className={`${styles.skeleton} ${styles.skeletonRow}`} style={{ height: '32px' }} />)}
        </div>
        <div className={styles.skeletonBlock}>
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className={`${styles.skeleton} ${styles.skeletonRow}`} style={{ height: '32px' }} />)}
        </div>
      </div>
      
      {/* Row 3 Skeleton */}
      <div className={styles.topGrid} style={{ marginTop: '8px' }}>
        <div className={styles.skeletonBlock}>
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          {[1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className={`${styles.skeleton} ${styles.skeletonRow}`} style={{ height: '20px' }} />)}
        </div>
        <div className={styles.skeletonBlock}>
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          {[1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className={`${styles.skeleton} ${styles.skeletonRow}`} style={{ height: '20px' }} />)}
        </div>
      </div>
    </div>
  );
}
