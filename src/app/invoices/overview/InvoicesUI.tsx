'use client';

import React from 'react';
import styles from './invoices.module.css';
import { Activity, Search } from 'lucide-react';
import { formatMoney as sysFormatMoney } from '@/lib/formatters';

function DisplayMoney({ value, currency }: { value: number; currency: 'aed' | 'usd' }) {
  const finalValue = currency === 'usd' ? value / 3.673 : value;
  return <span>{sysFormatMoney(finalValue, currency)}</span>;
}

export function InvoiceCard({ 
  title, 
  value, 
  subtext, 
  isMoney = false, 
  currency = 'aed' 
}: { 
  title: string; 
  value: number; 
  subtext?: string; 
  isMoney?: boolean; 
  currency?: 'aed' | 'usd' 
}) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiLabel}>{title}</div>
      <div className={styles.kpiValue}>
        {isMoney ? <DisplayMoney value={value} currency={currency} /> : value.toLocaleString()}
      </div>
      {subtext && <div className={styles.kpiSubtext}>{subtext}</div>}
    </div>
  );
}

export function InvoicesTable({ 
  rows, 
  title, 
  currency,
  activeTab,
  setActiveTab
}: { 
  rows: any[]; 
  title: string; 
  currency: 'aed' | 'usd';
  activeTab: 'short' | 'long';
  setActiveTab: (val: 'short' | 'long') => void;
}) {
  const [search, setSearch] = React.useState('');
  const filtered = rows.filter((s) => 
    s.brokerName?.toLowerCase().includes(search.toLowerCase()) ||
    s.invoiceTitle?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.tableContainer}>
      <div className={styles.sectionTitle} style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={14} />
            <span>{title}</span>
          </div>

          <div className={styles.tabToggle}>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'short' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('short')}
            >
              Инвойс выставлен
            </button>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'long' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('long')}
            >
              Инвойс не выставлен
            </button>
          </div>
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
              <th>ИМЯ БРОКЕРА</th>
              <th>НАЗВАНИЕ</th>
              <th style={{ textAlign: 'left' }}>ДОХОД КОМПАНИИ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '11px', borderRight: 'none' }}>
                  {activeTab === 'short'
                    ? 'Нет сделок в статусе "Инвойс выставлен" за выбранный период'
                    : 'Нет сделок в статусе "Новая сделка" за выбранный период'}
                </td>
              </tr>
            ) : (
              filtered.map((s, i) => (
                <tr key={i}>
                  <td><div className={styles.rank}>{i + 1}</div></td>
                  <td><div className={styles.sourceCell}>{s.brokerName || '-'}</div></td>
                  <td><div className={styles.sourceCell}>{s.invoiceTitle || '-'}</div></td>
                  <td style={{ fontWeight: 700, color: 'var(--white-soft)', textAlign: 'left' }}>
                    <DisplayMoney value={s.companyIncome || 0} currency={currency} />
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

export function InvoicesSkeleton() {
  return (
    <div className={styles.container} style={{ padding: 0 }}>
      <div className={styles.kpiGrid}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className={`${styles.kpiCard} ${styles.skeleton}`} style={{ height: '100px' }} />
        ))}
      </div>
      <div className={`${styles.tableContainer} ${styles.skeleton}`} style={{ height: '400px', marginTop: '16px' }} />
    </div>
  );
}
