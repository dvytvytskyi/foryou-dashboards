import React from 'react';
import styles from '../red/Scoreboard.module.css';
import { Info } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';

export type FacebookScoreboardData = {
  leads: number;
  ql: number;
  meetings: number;
  deals: number;
  revenue: number;
};

export default function FacebookScoreboard({ data }: { data: FacebookScoreboardData }) {
  const cards = [
    { label: 'Leads всего', value: data.leads },
    { label: 'QL всего', value: data.ql },
    { label: 'Meetings (за период)', value: data.meetings },
    { label: 'Deals (за период)', value: data.deals },
    { label: 'Выручка (за период)', value: formatMoney(data.revenue) },
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
        </div>
      ))}
    </div>
  );
}
