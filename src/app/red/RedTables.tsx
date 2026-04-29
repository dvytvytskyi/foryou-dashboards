'use client';

import React, { useMemo, useState } from 'react';
import { BarChart2, ChevronDown, ChevronRight } from 'lucide-react';
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

type GeoGroupItem = { label: string; leads: number };
type RedGeoData = {
  totalRedLeads: number;
  countries: GeoGroupItem[];
  phoneCodes: GeoGroupItem[];
};

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

export function RedGeoTable({ data }: { data?: RedGeoData | null }) {
  const [countriesOpen, setCountriesOpen] = useState(true);
  const [phonesOpen, setPhonesOpen] = useState(true);

  const countries = useMemo(() => data?.countries || [], [data]);
  const phoneCodes = useMemo(() => data?.phoneCodes || [], [data]);
  const total = Number(data?.totalRedLeads || 0);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}><BarChart2 size={15} /></span>
        <h2 className={styles.cardTitle}>География и номера телефонов</h2>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.tableContainer}>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thLeft}>Категория</th>
                  <th>Leads</th>
                </tr>
              </thead>
              <tbody>
                {!data ? (
                  <tr className={styles.emptyRow}>
                    <td colSpan={2}>Нет данных</td>
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td className={styles.tdLeft}>
                        <button className={styles.geoToggle} type="button" onClick={() => setCountriesOpen((v) => !v)}>
                          {countriesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <span>Країни (по номерам)</span>
                        </button>
                      </td>
                      <td>{total}</td>
                    </tr>
                    {countriesOpen && countries.map((item) => (
                      <tr key={`country-${item.label}`}>
                        <td className={styles.tdLeft}>{`  ${item.label.replace('Country: ', '')}`}</td>
                        <td>{item.leads}</td>
                      </tr>
                    ))}

                    <tr>
                      <td className={styles.tdLeft}>
                        <button className={styles.geoToggle} type="button" onClick={() => setPhonesOpen((v) => !v)}>
                          {phonesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <span>Номери телефонів (коди)</span>
                        </button>
                      </td>
                      <td>{total}</td>
                    </tr>
                    {phonesOpen && phoneCodes.map((item) => (
                      <tr key={`phone-${item.label}`}>
                        <td className={styles.tdLeft}>{`  ${item.label.replace('Phone code: ', '')}`}</td>
                        <td>{item.leads}</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
