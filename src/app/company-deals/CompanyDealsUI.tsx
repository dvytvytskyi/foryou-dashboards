'use client';

import React from 'react';
import styles from './company-deals.module.css';
import { Activity, ChevronDown, ChevronRight, Search } from 'lucide-react';

import { formatMoney as sysFormatMoney } from '@/lib/formatters';

const formatPct = (v: number) => `${Math.round(v || 0)}%`;

function DisplayMoney({ value, currency }: { value: number, currency: 'aed' | 'usd' }) {
  return <span>{sysFormatMoney(value, currency)}</span>;
}

function formatDealDate(value: string) {
  if (!value || value === '-') return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('ru-RU');
}

export function CompanyDealCard({ title, data, currency }: { title: string, data: any, currency: 'aed' | 'usd' }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiLabel}>{title}</div>
      <div className={styles.kpiValue} style={{ fontSize: '20px', marginBottom: '12px' }}>
        {data.deals || 0} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}>сделок</span>
      </div>
      
      <div className={styles.metricsRow} style={{ gap: '16px' }}>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>СУММА СДЕЛОК</span>
          <span className={styles.metricValue} style={{ color: 'var(--white-soft)', fontSize: '13px' }}>
            <DisplayMoney value={data.gmv || 0} currency={currency} />
          </span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>КОМИССИЯ</span>
          <span className={styles.metricValue} style={{ fontSize: '13px' }}>
            <DisplayMoney value={data.gross || 0} currency={currency} />
          </span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>ДОХОД</span>
          <span className={styles.metricValue}>
            <DisplayMoney value={data.net || 0} currency={currency} />
          </span>
        </div>
      </div>
    </div>
  );
}

export function CompanyDealsTable({ rows, title, currency }: { rows: any[], title: string, currency: 'aed' | 'usd' }) {
  const [search, setSearch] = React.useState('');
  const filtered = rows.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={styles.tableContainer}>
      <div className={styles.sectionTitle} style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={14} />
          <span>{title}</span>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={12} style={{ position: 'absolute', left: '10px', color: 'var(--muted)' }} />
          <input 
            type="text" 
            placeholder="Поиск..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              background: 'var(--bg-0)', 
              border: '1px solid var(--line)', 
              borderRadius: '6px', 
              padding: '4px 10px 4px 28px',
              fontSize: '11px',
              color: 'var(--white-soft)',
              outline: 'none'
            }} 
          />
        </div>
      </div>
      
      <div className={styles.tableWrapper} style={{ marginTop: '16px' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>ИСТОЧНИК</th>
              <th style={{ textAlign: 'left' }}>КОЛ-ВО</th>
              <th style={{ textAlign: 'left' }}>ДОЛЯ</th>
              <th style={{ textAlign: 'left' }}>ДОХОД</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '11px', borderRight: 'none' }}>
                  Нет данных для отображения
                </td>
              </tr>
            ) : (
              filtered.map((s, i) => (
                <tr key={s.name || i}>
                  <td><div className={styles.rank}>{i + 1}</div></td>
                  <td><div className={styles.sourceCell}>{s.name || '-'}</div></td>
                  <td style={{ textAlign: 'left' }}>{s.count || 0}</td>
                  <td style={{ textAlign: 'left' }}>{formatPct(s.share || 0)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--white-soft)', textAlign: 'left' }}>
                    <DisplayMoney value={s.revenue || 0} currency={currency} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SupportDetailsTable({ rows, currency }: { rows: any[], currency: 'aed' | 'usd' }) {
  const [search, setSearch] = React.useState('');
  const [expandedRows, setExpandedRows] = React.useState<Record<string, boolean>>({});
  const filtered = rows.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));

  const toggleRow = (name: string) => {
    setExpandedRows((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className={styles.tableContainer}>
      <div className={styles.sectionTitle} style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={14} />
          <span>Детализация сопровождения</span>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={12} style={{ position: 'absolute', left: '10px', color: 'var(--muted)' }} />
          <input 
            type="text" 
            placeholder="Поиск..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              background: 'var(--bg-0)', 
              border: '1px solid var(--line)', 
              borderRadius: '6px', 
              padding: '4px 10px 4px 28px',
              fontSize: '11px',
              color: 'var(--white-soft)',
              outline: 'none'
            }} 
          />
        </div>
      </div>
      
      <div className={styles.tableWrapper} style={{ marginTop: '16px' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>ДЕТАЛИЗАЦИЯ СОПРОВОЖДЕНИЯ</th>
              <th style={{ textAlign: 'left' }}>КОЛИЧЕСТВО</th>
              <th style={{ textAlign: 'left' }}>ДОХОД</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '11px', borderRight: 'none' }}>
                  Нет данных для отображения
                </td>
              </tr>
            ) : (
              filtered.map((s, i) => {
                const isExpanded = Boolean(expandedRows[s.name || '']);

                return (
                  <React.Fragment key={s.name || i}>
                    <tr>
                      <td><div className={styles.rank}>{i + 1}</div></td>
                      <td>
                        <button
                          type="button"
                          className={styles.expandButton}
                          onClick={() => toggleRow(s.name || '')}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <span className={styles.sourceCell}>{s.name || '-'}</span>
                        </button>
                      </td>
                      <td className={styles.numCell} style={{ textAlign: 'left' }}>{s.count || 0}</td>
                      <td className={styles.numCell} style={{ fontWeight: 700, color: 'var(--white-soft)', textAlign: 'left' }}>
                        <DisplayMoney value={s.revenue || 0} currency={currency} />
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr>
                        <td colSpan={4} className={styles.detailCell}>
                          <div className={styles.detailPanel}>
                            <div className={styles.detailPanelTitle}>Список сделок</div>
                            <div className={styles.detailTableWrapper}>
                              <table className={styles.detailTable}>
                                <thead>
                                  <tr>
                                    <th>Дата</th>
                                    <th>Партнер</th>
                                    <th>Источник</th>
                                    <th>Сумма сделки</th>
                                    <th>Комиссия</th>
                                    <th>Доход</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(s.details || []).map((detail: any, detailIndex: number) => (
                                    <tr key={`${s.name}-${detail.date}-${detailIndex}`}>
                                      <td>{formatDealDate(detail.date)}</td>
                                      <td>{detail.partner || '-'}</td>
                                      <td>{detail.source || '-'}</td>
                                      <td><DisplayMoney value={detail.gmv || 0} currency={currency} /></td>
                                      <td><DisplayMoney value={detail.gross || 0} currency={currency} /></td>
                                      <td><DisplayMoney value={detail.revenue || 0} currency={currency} /></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ValueWithBar({ value, max, currency, isMoney = false, subtext }: { value: number, max: number, currency?: 'aed' | 'usd', isMoney?: boolean, subtext?: string }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px 0' }}>
      <div className={styles.barContainer}>
        <div className={styles.valueLabel} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--white-soft)', minWidth: '80px' }}>
          {isMoney && currency ? (
            <DisplayMoney value={value} currency={currency} />
          ) : (
            value.toLocaleString()
          )}
        </div>
        <div className={styles.barWrapper} style={{ flex: 1, height: '6px', background: 'var(--line)', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' }}>
          <div 
            className={styles.barFill} 
            style={{ 
              width: `${percentage}%`, 
              height: '100%', 
              background: 'var(--accent)', 
              borderRadius: '3px' 
            }} 
          />
        </div>
      </div>
      {subtext && (
        <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>
          {subtext}
        </div>
      )}
    </div>
  );
}

export function BrokerRatingsTable({ rows, currency }: { rows: any[], currency: 'aed' | 'usd' }) {
  const [search, setSearch] = React.useState('');
  const filtered = rows.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));

  const maxRevenue = Math.max(...rows.map(r => r.revenue || 0), 1);
  const maxDeals = Math.max(...rows.map(r => r.deals || 0), 1);

  return (
    <div className={styles.tableContainer}>
      <div className={styles.sectionTitle} style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={14} />
          <span>Рейтинг брокеров и партнеров</span>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={12} style={{ position: 'absolute', left: '10px', color: 'var(--muted)' }} />
          <input 
            type="text" 
            placeholder="Поиск..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              background: 'var(--bg-0)', 
              border: '1px solid var(--line)', 
              borderRadius: '6px', 
              padding: '4px 10px 4px 28px',
              fontSize: '11px',
              color: 'var(--white-soft)',
              outline: 'none'
            }} 
          />
        </div>
      </div>
      
      <div className={styles.tableWrapper} style={{ marginTop: '16px' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>РЕЙТИНГ БРОКЕРОВ И ПАРТНЕРОВ</th>
              <th>ДОХОД БРОКЕРА</th>
              <th>КОЛИЧЕСТВО СДЕЛОК И ПАРТНЕРОВ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '11px', borderRight: 'none' }}>
                  Нет данных для отображения
                </td>
              </tr>
            ) : (
              filtered.map((s, i) => (
                <tr key={s.name || i}>
                  <td><div className={styles.rank}>{i + 1}</div></td>
                  <td><div className={styles.sourceCell}>{s.name || '-'}</div></td>
                  <td>
                    <ValueWithBar 
                      value={s.revenue || 0} 
                      max={maxRevenue} 
                      currency={currency} 
                      isMoney={true} 
                    />
                  </td>
                  <td>
                    <ValueWithBar 
                      value={s.deals || 0} 
                      max={maxDeals} 
                      subtext={`${s.deals || 0} сделок`}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AllianceTable({ rows, currency }: { rows: any[], currency: 'aed' | 'usd' }) {
  const [search, setSearch] = React.useState('');
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');

  const filtered = React.useMemo(() => {
    let result = rows.filter(s => 
      s.broker?.toLowerCase().includes(search.toLowerCase()) || 
      s.partner?.toLowerCase().includes(search.toLowerCase()) ||
      s.client?.toLowerCase().includes(search.toLowerCase())
    );

    if (sortKey) {
      result.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        
        // Date sorting
        if (sortKey === 'date') {
            const dA = new Date(valA).getTime();
            const dB = new Date(valB).getTime();
            return sortDirection === 'asc' ? dA - dB : dB - dA;
        }

        const strA = String(valA || '').toLowerCase();
        const strB = String(valB || '').toLowerCase();
        return sortDirection === 'asc' 
          ? strA.localeCompare(strB) 
          : strB.localeCompare(strA);
      });
    }

    return result;
  }, [rows, search, sortKey, sortDirection]);

  const requestSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const renderSortMark = (key: string) => {
    if (sortKey !== key) return <span className={styles.sortMark}>↕</span>;
    return <span className={styles.sortMark}>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className={styles.tableContainer}>
      <div className={styles.sectionTitle} style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={14} />
          <span>Сделки: Альянс</span>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={12} style={{ position: 'absolute', left: '10px', color: 'var(--muted)' }} />
          <input 
            type="text" 
            placeholder="Поиск по брокеру, партнеру..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              background: 'var(--bg-0)', 
              border: '1px solid var(--line)', 
              borderRadius: '6px', 
              padding: '4px 10px 4px 28px',
              fontSize: '11px',
              color: 'var(--white-soft)',
              outline: 'none',
              width: '200px'
            }} 
          />
        </div>
      </div>
      
      <div className={styles.tableWrapper} style={{ marginTop: '16px' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th className={styles.sortableHead} onClick={() => requestSort('type')}>ДЕПАРТАМЕНТ {renderSortMark('type')}</th>
              <th className={styles.sortableHead} onClick={() => requestSort('broker')}>БРОКЕР {renderSortMark('broker')}</th>
              <th className={styles.sortableHead} onClick={() => requestSort('partner')}>ПАРТНЕР {renderSortMark('partner')}</th>
              <th className={styles.sortableHead} onClick={() => requestSort('client')}>КЛИЕНТ {renderSortMark('client')}</th>
              <th className={styles.sortableHead} onClick={() => requestSort('date')}>ДАТА {renderSortMark('date')}</th>
              <th className={styles.sortableHead} onClick={() => requestSort('gmv')}>СУММА СДЕЛКИ {renderSortMark('gmv')}</th>
              <th className={styles.sortableHead} onClick={() => requestSort('gross')}>КОМИССИЯ {renderSortMark('gross')}</th>
              <th className={styles.sortableHead} onClick={() => requestSort('net')}>ДОХОД {renderSortMark('net')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '11px', borderRight: 'none' }}>
                  Нет данных для отображения
                </td>
              </tr>
            ) : (
              filtered.map((s, i) => (
                <tr key={i}>
                  <td><div className={styles.rank}>{i + 1}</div></td>
                  <td><div className={styles.sourceCell} style={{ fontSize: '11px' }}>{s.type || '-'}</div></td>
                  <td><div className={styles.sourceCell}>{s.broker || '-'}</div></td>
                  <td style={{ color: 'var(--white-soft)' }}>{s.partner || '-'}</td>
                  <td style={{ fontSize: '11px', color: 'var(--muted)' }}>{s.client || '-'}</td>
                  <td style={{ fontSize: '11px' }}>{formatDealDate(s.date)}</td>
                  <td style={{ textAlign: 'left' }}><DisplayMoney value={s.gmv || 0} currency={currency} /></td>
                  <td style={{ textAlign: 'left' }}><DisplayMoney value={s.gross || 0} currency={currency} /></td>
                  <td style={{ fontWeight: 700, color: 'var(--white-soft)', textAlign: 'left' }}>
                    <DisplayMoney value={s.net || 0} currency={currency} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CompanyDealsSkeleton() {
  return (
    <div className={styles.container} style={{ padding: 0 }}>
      <div className={styles.kpiGrid}>
        {[1, 2, 3, 4].map(i => <div key={i} className={`${styles.kpiCard} ${styles.skeleton}`} style={{ height: '140px' }} />)}
      </div>
      <div className={`${styles.tableContainer} ${styles.skeleton}`} style={{ height: '400px', marginTop: '16px' }} />
    </div>
  );
}
