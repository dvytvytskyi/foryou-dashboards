'use client';

import React from 'react';
import { BarChart2 } from 'lucide-react';
import styles from './RedTables.module.css';

const MAIN_COLUMNS = [
  { key: 'source', label: 'Источник / РК' },
  { key: 'budget', label: 'Budget' },
  { key: 'leads', label: 'Leads' },
  { key: 'cpl', label: 'CPL' },
  { key: 'no_answer_spam', label: 'No answer / Spam' },
  { key: 'rate_answer', label: '% rate answer' },
  { key: 'qualified_leads', label: 'Qualified Leads' },
  { key: 'cost_per_qualified_leads', label: 'Cost Per Qualified Leads' },
  { key: 'ql_actual', label: 'QL Actual' },
  { key: 'cpql_actual', label: 'CPQL Actual' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'cp_meetings', label: 'CP Meetings' },
  { key: 'deals', label: 'Deals' },
  { key: 'cost_per_deal', label: 'Cost Per Deal' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'roi', label: 'ROI' },
  { key: 'company_revenue', label: 'Company revenue' },
];

const GEO_COLUMNS = [
  { key: 'category', label: 'Категория' },
  { key: 'leads', label: 'Leads' },
  { key: 'no_answer_spam', label: 'No answer / Spam' },
  { key: 'rate_answer', label: '% rate answer' },
  { key: 'qualified_leads', label: 'Qualified Leads' },
  { key: 'cr_ql', label: 'CR QL' },
  { key: 'ql_actual', label: 'QL Actual' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'deals', label: 'Deals' },
  { key: 'revenue', label: 'Revenue' },
];

interface RedTableProps {
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  title: string;
  firstKey: string;
}

function RedTable({ columns, rows, title, firstKey }: RedTableProps) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}><BarChart2 size={15} /></span>
        <h2 className={styles.cardTitle}>{title}</h2>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.tableContainer}>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={col.key === firstKey ? styles.thLeft : undefined}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className={styles.emptyRow}>
                    <td colSpan={columns.length}>Нет данных</td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr key={i}>
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={col.key === firstKey ? styles.tdLeft : undefined}
                        >
                          {row[col.key] != null ? String(row[col.key]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RedMainTable({ rows = [] }: { rows?: Record<string, unknown>[] }) {
  return (
    <RedTable
      columns={MAIN_COLUMNS}
      rows={rows}
      title="Red Leads"
      firstKey="source"
    />
  );
}

export function RedGeoTable({ rows = [] }: { rows?: Record<string, unknown>[] }) {
  return (
    <RedTable
      columns={GEO_COLUMNS}
      rows={rows}
      title="География и телефоны"
      firstKey="category"
    />
  );
}
