import React from 'react';
import styles from './sales.module.css';
import { ArrowUpRight, ArrowDownRight, Info, User } from 'lucide-react';

const formatNum = (v: number) => v.toLocaleString();
const formatMoney = (v: number) => Math.round(v).toLocaleString();
const formatPct = (v: number) => `${(v * 100).toFixed(2)}%`;

export function SalesScoreboard({ data }: { data: any }) {
  const row1 = [
    { label: 'Всего лидов', value: formatNum(data.total_leads || 0), trend: '+2%', up: true },
    { label: 'Отказы/Потеряно', value: formatNum(data.lost_leads || 0), trend: '+175.8%', up: false, subValue: '175.8%' },
    { label: 'Закрыто сделок', value: formatNum(data.closed_deals || 0) },
    { label: 'Средний чек', value: formatMoney(data.avg_check || 0) },
    { label: 'Рентабельность %', value: formatPct(data.profitability_pct || 0) },
  ];

  const row2 = [
    { label: 'Объем продаж (GMV)', value: formatMoney(data.gmv || 0) },
    { label: 'Валовая комиссия (Gross)', value: formatMoney(data.gross_commission || 0) },
    { label: 'Чистая прибыль (Net)', value: formatMoney(data.net_profit || 0) },
    { label: 'Маржа %', value: formatPct(data.margin_pct || 0) },
  ];

  return (
    <div className={styles.scoreboardSection}>
      <div className={styles.scoreboardGrid}>
        {row1.map((c) => (
          <div key={c.label} className={styles.miniCard}>
            <div className={styles.miniLabel}>{c.label}</div>
            <div className={styles.miniValue}>{c.value}</div>
            {c.trend && (
              <div className={`${styles.trend} ${c.up ? styles.trendUp : styles.trendDown}`}>
                {c.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {c.trend}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={styles.scoreboardGridRow2}>
        {row2.map((c) => (
          <div key={c.label} className={styles.miniCard}>
            <div className={styles.miniLabel}>{c.label}</div>
            <div className={styles.miniValue}>{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfitBarChart({ brokers }: { brokers: any[] }) {
  const maxProfit = Math.max(...brokers.map((b) => b.net_profit || 0), 1);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        Топ по чистому доходу
        <span className={styles.dimmed}><Info size={14} /></span>
      </div>
      <div className={styles.chartList}>
        {brokers.slice(0, 10).map((b) => (
          <div key={b.broker_name} className={styles.chartItem}>
            <div className={styles.chartLabel}>
              <span>{b.broker_name}</span>
              <span className={styles.chartValue}>{formatMoney(b.net_profit)}</span>
            </div>
            <div className={styles.progressBarTrack}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${(b.net_profit / maxProfit) * 100}%` }}
              >
                {b.net_profit > maxProfit * 0.2 && formatMoney(b.net_profit)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BrokerKpiTable({ brokers }: { brokers: any[] }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>KPI брокеров</div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>Брокер</th>
              <th className={styles.numCell}>Валовый доход</th>
              <th className={styles.numCell}>Чистая прибыль</th>
              <th className={styles.numCell}>План: Сделки</th>
              <th className={styles.numCell}>План: Лиды</th>
            </tr>
          </thead>
          <tbody>
            {brokers.map((b, i) => (
              <tr key={b.broker_name}>
                <td><div className={styles.rank}>{i + 1}</div></td>
                <td>
                  <div className={styles.brokerName}>
                    <User size={14} className={styles.dimmed} />
                    {b.broker_name}
                  </div>
                </td>
                <td className={styles.numCell}>{formatMoney(b.gross_revenue)}</td>
                <td className={styles.numCell}>{formatMoney(b.net_profit)}</td>
                <td className={styles.numCell}>{b.plan_deals || 'null'}</td>
                <td className={styles.numCell}>{b.plan_leads || 'null'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
