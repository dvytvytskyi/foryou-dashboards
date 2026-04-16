import React from 'react';
import styles from './Scoreboard.module.css';
import { Info } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';

export type ScoreboardData = {
  ql: number;
  cpql: number;
  spend: number;
  revenue: number;
  qlDeltaUnits: number;
  cpqlDeltaPct: number;
  spendDeltaPct: number;
  revenueDeltaPct: number;
};

export default function Scoreboard({ data }: { data: ScoreboardData }) {
  const cards = [
    {
      label: 'QL всего',
      value: data.ql,
    },
    {
      label: 'CPQL (за период)',
      value: formatMoney(data.cpql),
    },
    {
      label: 'Расход (за период)',
      value: formatMoney(data.spend),
    },
    {
      label: 'Выручка (за период)',
      value: formatMoney(data.revenue),
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
        </div>
      ))}
    </div>
  );
}
