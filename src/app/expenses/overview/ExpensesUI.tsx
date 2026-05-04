'use client';

import React from 'react';
import styles from './expenses.module.css';
import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
import { formatMoney as sysFormatMoney, formatPercentRatio } from '@/lib/formatters';

function DisplayMoney({ value, currency }: { value: number; currency: 'aed' | 'usd' }) {
  return <span>{sysFormatMoney(value, currency)}</span>;
}

function TrendBadge({ value }: { value: number }) {
  const isPositive = value >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <div className={`${styles.trendBadge} ${isPositive ? styles.trendUp : styles.trendDown}`}>
      <Icon size={10} />
      <span>{Math.abs(value)}%</span>
    </div>
  );
}

// 1. Доход (верхняя таблица)
export function IncomeTable({ rows, currency }: { rows: any[]; currency: 'aed' | 'usd' }) {
  const normalRows = rows.filter((r) => !r.isTotal);
  const totalDeals = normalRows.reduce((acc, r) => acc + (r.deals || 0), 0);
  const totalIncome = normalRows.reduce((acc, r) => acc + (r.income || 0), 0);

  return (
    <div className={styles.tableContainer}>
      <div className={styles.sectionTitle} style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={14} />
          <span>Доход</span>
        </div>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ТИП</th>
              <th style={{ textAlign: 'left' }}>КОЛ-ВО СДЕЛОК</th>
              <th style={{ textAlign: 'left' }}>СУММА ДОХОДА</th>
              <th style={{ textAlign: 'left' }}>СООТНОШЕНИЕ</th>
            </tr>
          </thead>
          <tbody>
            {normalRows.map((r, i) => (
              <tr key={r.type || i}>
                <td><div className={styles.sourceCell}>{r.type || '-'}</div></td>
                <td style={{ textAlign: 'left' }}>{r.deals || 0}</td>
                <td style={{ fontWeight: 700, color: 'var(--white-soft)', textAlign: 'left' }}>
                  <DisplayMoney value={r.income || 0} currency={currency} />
                </td>
                <td style={{ textAlign: 'left' }}>{formatPercentRatio(r.income / (totalIncome || 1), 1)}</td>
              </tr>
            ))}
            <tr className={styles.totalRow}>
              <td>ИТОГО</td>
              <td style={{ textAlign: 'left' }}>{totalDeals}</td>
              <td style={{ color: 'var(--white-soft)', textAlign: 'left' }}>
                <DisplayMoney value={totalIncome} currency={currency} />
              </td>
              <td style={{ textAlign: 'left' }}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 2. Расход + Результат
export function SummaryTable({ rows, result, currency }: { rows: any[]; result: number; currency: 'aed' | 'usd' }) {
  const totalAmount = rows.reduce((acc, r) => acc + (r.amount || 0), 0);

  return (
    <div className={styles.tableContainer}>
      <div className={styles.sectionTitle} style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={14} />
          <span>Расход + Результат</span>
        </div>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>КАТЕГОРИЯ</th>
              <th style={{ textAlign: 'left' }}>СУММА</th>
              <th style={{ textAlign: 'left' }}>СООТНОШЕНИЕ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.category || i}>
                <td><div className={styles.sourceCell}>{r.category || '-'}</div></td>
                <td style={{ fontWeight: 700, color: 'var(--white-soft)', textAlign: 'left' }}>
                  <DisplayMoney value={r.amount || 0} currency={currency} />
                </td>
                <td style={{ textAlign: 'left' }}>{formatPercentRatio(r.amount / (totalAmount || 1), 1)}</td>
              </tr>
            ))}
            <tr className={styles.totalRow}>
              <td>ИТОГО (РАСХОД)</td>
              <td style={{ color: 'var(--negative)', textAlign: 'left' }}>
                <DisplayMoney value={totalAmount} currency={currency} />
              </td>
              <td style={{ textAlign: 'left' }}>100%</td>
            </tr>
            <tr className={styles.resultRow}>
              <td><span className={styles.resultLabel}>РЕЗУЛЬТАТ</span></td>
              <td style={{ textAlign: 'left' }}>
                <div className={styles.resultValue} style={{ color: 'var(--white-soft)' }}>
                  <DisplayMoney value={result} currency={currency} />
                </div>
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Helper to render Detail Sub-Table
function ExpenseRowDetails({ category, currency }: { category: any; currency: 'aed' | 'usd' }) {
  const details = category.details || [];
  
  if (details.length === 0) {
    return (
      <div style={{ padding: '12px 20px', color: 'var(--muted)', fontSize: '11px' }}>
        Нет данных за предыдущие периоды
      </div>
    );
  }

  // Determine which type of sub-table to show
  const isTotalExpense = category.name === 'Сумма расхода';
  const isResult = category.name === 'Доход компании (доход - расход)' || category.isResult;

  return (
    <div className={styles.detailPanel}>
      <table className={styles.detailTable}>
        <thead>
          <tr>
            <th>Месяц</th>
            {isTotalExpense ? (
              <>
                <th>Расход</th>
                <th>Доход</th>
              </>
            ) : isResult ? (
              <>
                <th>Доход</th>
                <th>Расход</th>
                <th>Результат</th>
              </>
            ) : (
              <>
                <th>Сумма</th>
                <th>Доля в расходе</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {details.map((d: any, idx: number) => (
            <tr key={idx}>
              <td>{d.monthLabel}</td>
              {isTotalExpense ? (
                <>
                  <td><DisplayMoney value={d.value} currency={currency} /></td>
                  <td><DisplayMoney value={d.income} currency={currency} /></td>
                </>
              ) : isResult ? (
                <>
                  <td><DisplayMoney value={d.income} currency={currency} /></td>
                  <td><DisplayMoney value={d.expense} currency={currency} /></td>
                  <td style={{ fontWeight: 600, color: d.value >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                    <DisplayMoney value={d.value} currency={currency} />
                  </td>
                </>
              ) : (
                <>
                  <td><DisplayMoney value={d.value} currency={currency} /></td>
                  <td>{d.shareOfExpense ? `${d.shareOfExpense}%` : '-'}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 3. Детализация расход
import { ChevronDown, ChevronRight } from 'lucide-react';

export function ExpenseDetailsTable({ categories, currency }: { categories: any[]; currency: 'aed' | 'usd' }) {
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());

  const toggleRow = (name: string) => {
    const next = new Set(expandedRows);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpandedRows(next);
  };

  return (
    <div className={styles.tableContainer}>
      <div className={styles.sectionTitle} style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={14} />
          <span>Детализация расходов</span>
        </div>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>КАТЕГОРИЯ</th>
              <th style={{ textAlign: 'left' }}>ТЕКУЩИЙ ПЕРИОД</th>
              <th style={{ textAlign: 'left' }}>MoM</th>
              <th style={{ textAlign: 'left' }}>QoQ</th>
              <th style={{ textAlign: 'left' }}>YoY</th>
              <th style={{ textAlign: 'left' }}>AVERAGE</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c, i) => {
              const isExpanded = expandedRows.has(c.name);
              const rowKey = c.name || `row-${i}`;
              
              return (
                <React.Fragment key={rowKey}>
                  <tr className={c.isTotal ? styles.totalRow : c.isResult ? styles.resultRow : undefined}>
                    <td style={{ textAlign: 'center', padding: '0' }}>
                      <button 
                        onClick={() => toggleRow(c.name)}
                        className={styles.expandButton}
                        style={{ padding: '8px' }}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                    <td><div className={styles.sourceCell}>{c.name || '-'}</div></td>
                    <td style={{ fontWeight: 700, color: 'var(--white-soft)', textAlign: 'left' }}>
                      <DisplayMoney value={c.current || 0} currency={currency} />
                    </td>
                    <td style={{ textAlign: 'left' }}><TrendBadge value={c.mom || 0} /></td>
                    <td style={{ textAlign: 'left' }}><TrendBadge value={c.qoq || 0} /></td>
                    <td style={{ textAlign: 'left' }}><TrendBadge value={c.yoy || 0} /></td>
                    <td style={{ textAlign: 'left' }}>
                      <DisplayMoney value={c.average || 0} currency={currency} />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className={styles.detailCell}>
                        <ExpenseRowDetails category={c} currency={currency} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ExpensesSkeleton() {
  return (
    <div className={styles.container} style={{ padding: 0 }}>
      <div className={styles.tableContainer} style={{ height: '200px', marginBottom: '16px', opacity: 0.5 }} />
      <div className={styles.tableContainer} style={{ height: '250px', marginBottom: '16px', opacity: 0.5 }} />
      <div className={styles.tableContainer} style={{ height: '300px', opacity: 0.5 }} />
    </div>
  );
}
