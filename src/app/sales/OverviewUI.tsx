'use client';

import React from 'react';
import styles from './sales.module.css';
import { ArrowUpRight, ArrowDownRight, Info, User, Search, X, Filter } from 'lucide-react';

const formatNum = (v: number) => v.toLocaleString();
const formatMoney = (v: number) => Math.round(v).toLocaleString();
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

export function SalesScoreboard({ data, onClick }: { data: any, onClick: (metric: string) => void }) {
  const kpis = [
    { id: 'COUNT', label: 'КОЛИЧЕСТВО СДЕЛОК', value: formatNum(data.closed_deals || 0), dynamics: [{ label: 'mom', value: '5%', up: true }, { label: 'qoq', value: '12%', up: true }, { label: 'yoy', value: '2%', up: false }] },
    { id: 'GMV', label: 'СУММА СДЕЛОК (GMV)', value: formatMoney(data.gmv || 0), dynamics: [{ label: 'mom', value: '8.4%', up: true }, { label: 'qoq', value: '22%', up: true }, { label: 'yoy', value: '45%', up: true }] },
    { id: 'GROSS', label: 'ВАЛОВАЯ КОМИССИЯ', value: formatMoney(data.gross_commission || 0), dynamics: [{ label: 'mom', value: '3.1%', up: true }, { label: 'qoq', value: '15.4%', up: true }, { label: 'yoy', value: '18%', up: true }] },
    { id: 'NET', label: 'ДОХОД КОМПАНИИ (NET)', value: formatMoney(data.net_profit || 0), dynamics: [{ label: 'mom', value: '1.2%', up: true }, { label: 'qoq', value: '8.9%', up: true }, { label: 'yoy', value: '11.2%', up: true }] },
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

export function DealsModal({ isOpen, onClose, deals, highlightMetric }: { isOpen: boolean, onClose: () => void, deals: any[], highlightMetric?: string | null }) {
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
                  <td style={{ ...getColStyle('COUNT'), whiteSpace: 'nowrap' }}>{d.date}</td>
                  <td style={{ ...getColStyle('COUNT'), fontWeight: 600 }}>{d.broker}</td>
                  <td style={{ color: 'var(--muted)', fontSize: '11px' }}>{d.info}</td>
                  <td>
                    <span className={styles.typeBadge} style={{ 
                      backgroundColor: d.type === 'Offplan' ? 'rgba(255,255,255,0.1)' : 'rgba(128,128,128,0.1)',
                      color: 'var(--white-soft)'
                    }}>
                      {d.type}
                    </span>
                  </td>
                  <td className={styles.numCell} style={getColStyle('GMV')}>{formatMoney(d.gmv)}</td>
                  <td className={styles.numCell} style={getColStyle('GROSS')}>{formatMoney(d.gross)}</td>
                  <td className={styles.numCell} style={{ ...getColStyle('NET'), color: 'var(--accent)', fontWeight: 700 }}>{formatMoney(d.net)}</td>
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
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Распределение по типам</div>
      <div className={styles.distributionContainer}>
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

export function DepartmentBreakdown({ data }: { data: any[] }) {
  const depts = data && data.length > 0 ? data : [
    { label: 'Прямые продажи', value: 0, share: 0, color: 'var(--white-soft)' },
    { label: 'Партнеры', value: 0, share: 0, color: 'var(--muted)' },
  ];

  const maxVal = Math.max(...depts.map(d => d.value), 1);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Доходность по источникам</div>
      <div className={styles.deptListScroll}>
        <div className={styles.deptList}>
          {depts.map((d) => (
            <div key={d.label} className={styles.barChartRow}>
              <div className={styles.barChartHeader}>
                <span className={styles.barChartLabel}>{d.label} <span style={{ color: 'var(--muted)', fontSize: '11px', marginLeft: '4px' }}>{d.share}%</span></span>
                <span className={styles.barChartValue}>{formatMoney(d.value)} AED</span>
              </div>
              <div className={styles.barChartTrack}>
                <div 
                  className={styles.barChartFill} 
                  style={{ width: `${(d.value / maxVal) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SupportSection({ data }: { data: any[] }) {
  const managers = data && data.length > 0 ? data : [{ name: 'Крис', deals: 0, revenue: 0, color: '#6366f1' }, { name: 'Яна', deals: 0, revenue: 0, color: '#ec4899' }];
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Сопровождение</div>
      <div className={styles.supportGrid}>
        {managers.map((m) => (
          <div key={m.name} className={styles.supportCard}>
            <div className={styles.supportHeader}>
              <div className={styles.supportAvatar} style={{ backgroundColor: `${m.color}15`, color: m.color }}>{m.name[0]}</div>
              <div className={styles.supportName}>{m.name}</div>
            </div>
            <div className={styles.supportMetrics}>
              <div className={styles.supportMetric}><span className={styles.smLabel}>Сделок</span><span className={styles.smValue}>{m.deals}</span></div>
              <div className={styles.supportMetric}><span className={styles.smLabel}>Сумма сопровожд.</span><span className={styles.smValue}>{formatMoney(m.fee || 0)}</span></div>
              <div className={styles.supportMetric}><span className={styles.smLabel}>Доход компании</span><span className={styles.smValue}>{formatMoney(m.revenue)}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfitBarChart({ brokers }: { brokers: any[] }) {
  const sorted = [...(brokers || [])].sort((a, b) => b.net_profit - a.net_profit);
  const maxProfit = Math.max(...sorted.map((b) => b.net_profit || 0), 1);
  
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Top по чистому доходу</div>
      <div className={styles.chartListScroll}>
        <div className={styles.chartList}>
          {sorted.slice(0, 15).map((b) => (
            <div key={b.broker_name} className={styles.barChartRow}>
              <div className={styles.barChartHeader}>
                <span className={styles.barChartLabel}>{b.broker_name}</span>
                <span className={styles.barChartValue}>{formatMoney(b.net_profit)} AED</span>
              </div>
              <div className={styles.barChartTrack}>
                <div 
                  className={styles.barChartFill} 
                  style={{ width: `${(b.net_profit / maxProfit) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BrokerKpiTable({ brokers }: { brokers: any[] }) {
  const [search, setSearch] = React.useState('');
  const filtered = (brokers || []).filter(b => b.broker_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>KPI брокеров
        <div className={styles.searchWrapper}>
          <Search size={14} className={styles.searchIcon} />
          <input type="text" placeholder="Поиск брокера..." className={styles.tableSearch} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className={styles.tableWrapper}>
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
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => (
                <tr key={b.broker_name}>
                  <td><div className={styles.rank}>{i + 1}</div></td>
                  <td>{b.broker_name}</td>
                  <td className={styles.numCell}>{formatMoney(b.gross_revenue)}</td>
                  <td className={styles.numCell} style={{ fontWeight: 700, color: 'var(--white-soft)' }}>{formatMoney(b.net_profit)}</td>
                  <td className={styles.numCell} style={{ opacity: 0.6 }}>{b.plan_deals || '-'}</td>
                  <td className={styles.numCell} style={{ opacity: 0.6 }}>{b.plan_leads || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function PartnersTable({ partners }: { partners: any[] }) {
  const [search, setSearch] = React.useState('');
  const filtered = (partners || []).filter(p => p.name?.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.revenue - a.revenue);
  
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Рейтинг Партнеров
        <div className={styles.searchWrapper}>
          <Search size={14} className={styles.searchIcon} />
          <input type="text" placeholder="Поиск партнера..." className={styles.tableSearch} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className={styles.tableWrapper}>
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
                  <td className={styles.numCell} style={{ fontWeight: 700, color: 'var(--white-soft)' }}>{formatMoney(p.revenue)}</td>
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
