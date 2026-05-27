'use client';

import React from 'react';
import styles from '../expenses.module.css';
import { TrendingUp, TrendingDown, Minus, Activity, DollarSign, Wallet } from 'lucide-react';
import { formatMoney as sysFormatMoney } from '@/lib/formatters';
import { FeedbackIconTrigger } from '@/components/FeedbackModal';

function DisplayMoney({ value, currency, short = false }: { value: number, currency: 'aed' | 'usd', short?: boolean }) {
  if (short && Math.abs(value) >= 1000) {
    const k = value / 1000;
    return <span>{sysFormatMoney(k, currency).replace(/\.00/, '')}K</span>;
  }
  return <span>{sysFormatMoney(value, currency)}</span>;
}

function DynamicBadge({ value, absValue, currency, inTable = false }: { value: number, absValue?: number, currency?: 'aed' | 'usd', inTable?: boolean }) {
  if (!value || isNaN(value)) {
    return (
      <div className={styles.dynamicBadge} style={{ background: 'transparent', color: 'var(--muted)', display: 'inline-flex', width: 'fit-content', alignSelf: 'flex-start', alignItems: 'center', gap: '4px', padding: inTable ? 0 : '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
        <Minus size={12} />
        0%
      </div>
    );
  }
  
  const isPositive = value > 0;
  const color = isPositive ? 'var(--red)' : 'var(--green)'; // For expenses, UP is bad (red), DOWN is good (green)
  
  return (
    <div className={styles.dynamicBadge} style={{ background: 'transparent', color, display: 'inline-flex', width: 'fit-content', alignSelf: 'flex-start', alignItems: 'center', gap: '4px', padding: inTable ? 0 : '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
      {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(value).toFixed(1)}%
      {absValue !== undefined && currency && (
        <span style={{ opacity: 0.8, marginLeft: '2px' }}>
          (<DisplayMoney value={Math.abs(absValue)} currency={currency} short={true} />)
        </span>
      )}
    </div>
  );
}

function DynamicBadgeIncome({ value, absValue, currency, inTable = false }: { value: number, absValue?: number, currency?: 'aed' | 'usd', inTable?: boolean }) {
  if (!value || isNaN(value)) {
    return (
      <div className={styles.dynamicBadge} style={{ background: 'transparent', color: 'var(--muted)', display: 'inline-flex', width: 'fit-content', alignSelf: 'flex-start', alignItems: 'center', gap: '4px', padding: inTable ? 0 : '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
        <Minus size={12} />
        0%
      </div>
    );
  }
  
  const isPositive = value > 0;
  const color = isPositive ? 'var(--green)' : 'var(--red)'; // For income, UP is good, DOWN is bad
  
  return (
    <div className={styles.dynamicBadge} style={{ background: 'transparent', color, display: 'inline-flex', width: 'fit-content', alignSelf: 'flex-start', alignItems: 'center', gap: '4px', padding: inTable ? 0 : '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
      {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(value).toFixed(1)}%
      {absValue !== undefined && currency && (
        <span style={{ opacity: 0.8, marginLeft: '2px' }}>
          (<DisplayMoney value={Math.abs(absValue)} currency={currency} short={true} />)
        </span>
      )}
    </div>
  );
}

export function ExpensesSummaryCard({ data, currency, isIncome = false }: { data: any, currency: 'aed' | 'usd', isIncome?: boolean }) {
  if (!data) return null;
  
  const Badge = isIncome ? DynamicBadgeIncome : DynamicBadge;
  
  return (
    <div className={styles.kpiCard} style={{ background: isIncome ? 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, var(--bg-1) 100%)' : 'var(--bg-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className={styles.kpiLabel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isIncome ? <DollarSign size={14} color="var(--green)" /> : <DollarSign size={14} color="var(--muted)" />}
          {data.name}
        </div>
        <FeedbackIconTrigger context={{ type: 'scorecard', title: data.name, page: '/expenses/overview', date: 'Current View' }} />
      </div>
      
      <div className={styles.kpiValue} style={{ fontSize: '24px', marginBottom: '16px', color: isIncome && data.current > 0 ? 'var(--green)' : 'var(--white-soft)' }}>
        <DisplayMoney value={data.current || 0} currency={currency} />
      </div>
      
      <div className={styles.metricsRow} style={{ gap: '16px', borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>СРЕДНЕЕ</span>
          <span className={styles.metricValue} style={{ fontSize: '13px' }}>
            <DisplayMoney value={data.average || 0} currency={currency} short={true} />
          </span>
        </div>
        
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>ОТ МЕСЯЦА К МЕСЯЦУ</span>
          <Badge value={data.mom} absValue={data.momAbs} currency={currency} />
        </div>
        
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>ОТ КВАРТАЛА К КВАРТАЛУ</span>
          <Badge value={data.qoq} absValue={data.qoqAbs} currency={currency} />
        </div>
        
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>ГОД</span>
          <Badge value={data.yoy} absValue={data.yoyAbs} currency={currency} />
        </div>
      </div>
    </div>
  );
}

export function ExpenseCategoriesTable({ rows, currency }: { rows: any[], currency: 'aed' | 'usd' }) {
  // Filter out Total and Result, keep only categories
  const categories = rows.filter(r => !r.isTotal && !r.isResult);
  
  return (
    <div className={styles.tableContainer}>
      <div className={styles.sectionTitle} style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={14} />
          <span>Детализация расхода по категориям</span>
          <FeedbackIconTrigger context={{ type: 'table', title: 'Детализация расхода по категориям', page: '/expenses/overview', date: 'Current View' }} />
        </div>
      </div>
      
      <div className={styles.tableWrapper} style={{ marginTop: '16px' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th style={{ textAlign: 'left' }}>КАТЕГОРИЯ</th>
              <th style={{ textAlign: 'left' }}>СУММА</th>
              <th style={{ textAlign: 'left' }}>СРЕДНЕЕ ЗА МЕСЯЦ</th>
              <th style={{ textAlign: 'left' }}>ОТ МЕСЯЦА К МЕСЯЦУ</th>
              <th style={{ textAlign: 'left' }}>ОТ КВАРТАЛА К КВАРТАЛУ</th>
              <th style={{ textAlign: 'left' }}>ГОД</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '11px', borderRight: 'none' }}>
                  Нет данных для отображения
                </td>
              </tr>
            ) : (
              categories.map((c, i) => (
                <tr key={c.name || i}>
                  <td><div className={styles.rank}>{i + 1}</div></td>
                  <td><div className={styles.sourceCell}>{c.name || '-'}</div></td>
                  <td style={{ fontWeight: 600, color: 'var(--white-soft)', textAlign: 'left' }}>
                    <DisplayMoney value={c.current || 0} currency={currency} />
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <DisplayMoney value={c.average || 0} currency={currency} />
                  </td>
                  <td style={{ textAlign: 'left' }}><DynamicBadge value={c.mom} absValue={c.momAbs} currency={currency} inTable={true} /></td>
                  <td style={{ textAlign: 'left' }}><DynamicBadge value={c.qoq} absValue={c.qoqAbs} currency={currency} inTable={true} /></td>
                  <td style={{ textAlign: 'left' }}><DynamicBadge value={c.yoy} absValue={c.yoyAbs} currency={currency} inTable={true} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ExpensesSkeleton() {
  return (
    <div className={styles.container} style={{ padding: 0 }}>
      <div className={styles.kpiGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {[1, 2].map(i => (
          <div key={i} className={styles.kpiCard} style={{ height: '160px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className={styles.skeleton} style={{ height: '16px', width: '40%', borderRadius: '4px' }} />
            <div className={styles.skeleton} style={{ height: '32px', width: '60%', borderRadius: '4px' }} />
            <div style={{ display: 'flex', gap: '16px', marginTop: 'auto', borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
              {[1, 2, 3, 4].map(j => (
                <div key={j} className={styles.skeleton} style={{ height: '20px', width: '20%', borderRadius: '4px' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.tableContainer} style={{ marginTop: '16px', padding: '16px' }}>
        <div className={styles.skeleton} style={{ height: '24px', width: '250px', borderRadius: '4px', marginBottom: '24px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ display: 'flex', gap: '16px' }}>
               <div className={styles.skeleton} style={{ height: '20px', width: '5%', borderRadius: '4px' }} />
               <div className={styles.skeleton} style={{ height: '20px', width: '25%', borderRadius: '4px' }} />
               <div className={styles.skeleton} style={{ height: '20px', width: '15%', borderRadius: '4px' }} />
               <div className={styles.skeleton} style={{ height: '20px', width: '15%', borderRadius: '4px' }} />
               <div className={styles.skeleton} style={{ height: '20px', width: '10%', borderRadius: '4px' }} />
               <div className={styles.skeleton} style={{ height: '20px', width: '10%', borderRadius: '4px' }} />
               <div className={styles.skeleton} style={{ height: '20px', width: '10%', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
