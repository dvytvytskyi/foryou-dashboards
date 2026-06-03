'use client';

import React from 'react';
import styles from './MarketingKpiTable.module.css';

type Row = any; // We'll accept the row type from DashboardPage loosely to avoid importing complex types

type KpiProps = {
  rows: Row[];
  startDate: string;
  endDate: string;
};

const PLAN_DATA = [
  { id: 'pf', source: 'Property Finder', planLeads: 60, match: (r: Row) => r.channel === 'Property Finder' },
  { id: 'red', source: 'RED RU', planLeads: 200, match: (r: Row) => r.channel === 'RED' && r.level_1 === 'RED_RU' },
  { id: 'target', source: 'Target Point', planLeads: 100, match: (r: Row) => (r.channel || '').includes('Target Point') || (r.level_1 || '').includes('Target Point') },
  { id: 'klykov', source: 'Klykov', planLeads: 50, match: (r: Row) => r.channel === 'Klykov' },
];

export default function MarketingKpiTable({ rows, startDate, endDate, isLoading }: KpiProps) {
  if ((!rows || rows.length === 0) && !isLoading) return null;

  const end = new Date(endDate || new Date().toISOString());
  const year = end.getFullYear();
  const month = end.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysPassed = end.getDate();

  const safeRows = rows || [];

  const data = PLAN_DATA.map((plan) => {
    let factLeads = 0;
    let factDeals = 0;
    let factBudget = 0;

    for (const r of safeRows) {
      if (plan.match(r)) {
        factLeads += Number(r.leads || 0);
        factDeals += Number(r.deals || 0);
        factBudget += Number(r.budget || 0);
      }
    }

    const pctDone = plan.planLeads > 0 ? (factLeads / plan.planLeads) * 100 : 0;
    const planPerDay = plan.planLeads / daysInMonth;
    const planCurrentDay = planPerDay * daysPassed;
    const deviation = factLeads - planCurrentDay;
    const pace = planCurrentDay > 0 ? (factLeads / planCurrentDay) * 100 : 0;
    const conversion = factLeads > 0 ? (factDeals / factLeads) * 100 : 0;
    const expectedDeals = factLeads * (conversion / 100);
    const costPerLead = factLeads > 0 ? factBudget / factLeads : 0;

    return {
      ...plan,
      factLeads,
      factDeals,
      factBudget,
      pctDone,
      planPerDay,
      planCurrentDay,
      deviation,
      pace,
      conversion,
      expectedDeals,
      costPerLead,
    };
  });

  const totals = {
    planLeads: data.reduce((sum, d) => sum + d.planLeads, 0),
    factLeads: data.reduce((sum, d) => sum + d.factLeads, 0),
    factDeals: data.reduce((sum, d) => sum + d.factDeals, 0),
    factBudget: data.reduce((sum, d) => sum + d.factBudget, 0),
    planCurrentDay: data.reduce((sum, d) => sum + d.planCurrentDay, 0),
  };
  
  const totalPctDone = totals.planLeads > 0 ? (totals.factLeads / totals.planLeads) * 100 : 0;
  const totalPlanPerDay = totals.planLeads / daysInMonth;
  const totalDeviation = totals.factLeads - totals.planCurrentDay;
  const totalPace = totals.planCurrentDay > 0 ? (totals.factLeads / totals.planCurrentDay) * 100 : 0;
  const totalConversion = totals.factLeads > 0 ? (totals.factDeals / totals.factLeads) * 100 : 0;
  const totalExpectedDeals = totals.factLeads * (totalConversion / 100);
  const totalCostPerLead = totals.factLeads > 0 ? totals.factBudget / totals.factLeads : 0;

  const formatNumber = (num: number, decimals: number = 1) => {
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num);
  };

  const formatInt = (num: number) => {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(num);
  };

  const renderCell = (content: React.ReactNode) => {
    if (isLoading) return <span className={styles.skeletonValue}></span>;
    return content;
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h2 className={styles.header}>
          KPI по лидогенерации — месячный план, темп и ожидаемые сделки
        </h2>
        <div className={styles.dateInfo}>
          <div className={styles.dateBlock}>
            <span className={styles.dateLabel}>Год</span>
            <span className={styles.dateValue}>{year}</span>
          </div>
          <div className={styles.dateBlock}>
            <span className={styles.dateLabel}>Месяц</span>
            <span className={styles.dateValue}>{month}</span>
          </div>
          <div className={styles.dateBlock}>
            <span className={styles.dateLabel}>Прошло дней</span>
            <span className={styles.dateValue}>{daysPassed}</span>
          </div>
          <div className={styles.dateBlock}>
            <span className={styles.dateLabel}>Дней в месяце</span>
            <span className={styles.dateValue}>{daysInMonth}</span>
          </div>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thLeft}>Источник</th>
              <th>План лидов (мес)</th>
              <th>Факт лидов</th>
              <th>% выполнения</th>
              <th>План / день</th>
              <th>План на текущий день</th>
              <th>Отклонение</th>
              <th>Темп к плану</th>
              <th>Конверсия в сделку</th>
              <th>Ожидаемые сделки</th>
              <th>Стоимость лида</th>
              <th>Бюджет факт</th>
              <th>Результат</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <td className={styles.tdLeft}>{row.source}</td>
                <td>{renderCell(formatInt(row.planLeads))}</td>
                <td className={styles.tdFact}>{renderCell(formatInt(row.factLeads))}</td>
                <td>{renderCell(`${formatNumber(row.pctDone)}%`)}</td>
                <td>{renderCell(formatNumber(row.planPerDay))}</td>
                <td>{renderCell(formatNumber(row.planCurrentDay))}</td>
                <td className={row.deviation < 0 ? styles.tdNegative : styles.tdPositive}>
                  {renderCell(
                    <>{row.deviation > 0 ? '+' : ''}{formatNumber(row.deviation)}</>
                  )}
                </td>
                <td>{renderCell(`${formatNumber(row.pace)}%`)}</td>
                <td className={styles.tdBlue}>{renderCell(`${formatNumber(row.conversion)}%`)}</td>
                <td>{renderCell(formatNumber(row.expectedDeals))}</td>
                <td>{renderCell(formatInt(row.costPerLead))}</td>
                <td>{renderCell(formatInt(row.factBudget))}</td>
                <td className={row.deviation < 0 ? styles.tdResultNegative : styles.tdResultPositive}>
                  {renderCell(
                    <div className={styles.resultBadge}>
                      <div className={row.deviation < 0 ? styles.dotRed : styles.dotGreen}></div>
                      {row.deviation < 0 ? 'Отставание' : 'В плане'}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={styles.rowFooter}>
              <td className={styles.tdLeft}>Итого</td>
              <td>{renderCell(formatInt(totals.planLeads))}</td>
              <td>{renderCell(formatInt(totals.factLeads))}</td>
              <td>{renderCell(`${formatNumber(totalPctDone)}%`)}</td>
              <td>{renderCell(formatNumber(totalPlanPerDay))}</td>
              <td>{renderCell(formatNumber(totals.planCurrentDay))}</td>
              <td className={totalDeviation < 0 ? styles.tdNegative : styles.tdPositive}>
                {renderCell(
                  <>{totalDeviation > 0 ? '+' : ''}{formatNumber(totalDeviation)}</>
                )}
              </td>
              <td>{renderCell(`${formatNumber(totalPace)}%`)}</td>
              <td>{renderCell(`${formatNumber(totalConversion)}%`)}</td>
              <td>{renderCell(formatNumber(totalExpectedDeals))}</td>
              <td>{renderCell(formatInt(totalCostPerLead))}</td>
              <td>{renderCell(formatInt(totals.factBudget))}</td>
              <td className={totalDeviation < 0 ? styles.tdResultNegative : styles.tdResultPositive}>
                {renderCell(
                  <div className={styles.resultBadge}>
                    <div className={totalDeviation < 0 ? styles.dotRed : styles.dotGreen}></div>
                    {totalDeviation < 0 ? 'Отставание' : 'В плане'}
                  </div>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
