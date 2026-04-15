'use client';

import React from 'react';
import styles from './directions.module.css';
import { Search } from 'lucide-react';

const formatMoney = (v: number) => Math.round(v).toLocaleString();
const formatPct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function DirectionCard({ title, data }: { title: string, data: any }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiLabel}>{title}</div>
      <div className={styles.kpiValue}>{data.deals || 0} сделок</div>
      
      <div className={styles.metricsRow}>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Net Profit</span>
          <span className={styles.metricValue}>{formatMoney(data.net || 0)}</span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>GMV</span>
          <span className={styles.metricValue}>{formatMoney(data.gmv || 0)}</span>
        </div>
        <div className={styles.metricItem} style={{ marginTop: '8px' }}>
          <span className={styles.metricLabel}>Avg Check</span>
          <span className={styles.metricValue}>{formatMoney(data.avg_check || 0)}</span>
        </div>
        <div className={styles.metricItem} style={{ marginTop: '8px' }}>
          <span className={styles.metricLabel}>Broker %</span>
          <span className={styles.metricValue}>{formatPct(data.broker_share || 0)}</span>
        </div>
      </div>
    </div>
  );
}

export function SourcePerformanceTable({ sources }: { sources: any[] }) {
  const [search, setSearch] = React.useState('');
  const filtered = sources.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={styles.tableContainer}>
      <div className={styles.sectionTitle}>
        Эффективность по источникам
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={12} style={{ position: 'absolute', left: '10px', color: 'var(--muted)' }} />
          <input 
            type="text" 
            placeholder="Поиск..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              background: 'var(--surface-input)', 
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
      
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>ИСТОЧНИК</th>
              <th>ВЫРУЧКА</th>
              <th>ДОХОД (NET)</th>
              <th>СДЕЛКИ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => {
              return (
                <tr key={s.name}>
                  <td><div className={styles.rank}>{i + 1}</div></td>
                  <td><div className={styles.sourceCell}>{s.name}</div></td>
                  <td>{formatMoney(s.revenue)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--white-soft)' }}>{formatMoney(s.net)}</td>
                  <td>{s.deals}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DirectionsSkeleton() {
  return (
    <div className={styles.container} style={{ padding: 0 }}>
      <div className={styles.kpiGrid}>
        {[1, 2, 3, 4].map(i => <div key={i} className={`${styles.kpiCard} ${styles.skeleton}`} style={{ height: '140px' }} />)}
      </div>
      <div className={`${styles.tableContainer} ${styles.skeleton}`} style={{ height: '400px', marginTop: '16px' }} />
    </div>
  );
}
