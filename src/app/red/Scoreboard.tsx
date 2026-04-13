import React from 'react';
import styles from './Scoreboard.module.css';
import { Info, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export type ScoreboardData = {
  leads: string | number;
  ql: string | number;
  cpql: string | number;
  spend: string | number;
  revenue: string | number;
};

export default function Scoreboard({ data }: { data: ScoreboardData }) {
  const cards = [
    {
      label: 'QL всего',
      value: data.ql,
      comparison: '+3 units',
      trend: 'up',
    },
    {
      label: 'CPQL (за период)',
      value: data.cpql,
      comparison: '9%',
      trend: 'up',
    },
    {
      label: 'Расход (за период)',
      value: data.spend,
      comparison: '7%',
      trend: 'up',
    },
    {
      label: 'Выручка (за период)',
      value: data.revenue,
      comparison: '5%',
      trend: 'up',
    },
  ];

  return (
    <div className={styles.scoreboardWrap}>
      {cards.map((card) => (
        <div className={styles.scoreboardCard} key={card.label}>
          <div className={styles.cardHeader}>
            <span className={styles.scoreboardLabel}>{card.label}</span>
            <Info size={14} className={styles.infoIcon} />
          </div>
          
          <div className={styles.scoreboardValue}>{card.value}</div>
          
          <div className={styles.cardFooter}>
            <span className={styles.comparisonText}>vs last month</span>
            <div className={`${styles.badge} ${card.trend === 'up' ? styles.badgeSuccess : styles.badgeWarning}`}>
              {card.trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {card.comparison}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
