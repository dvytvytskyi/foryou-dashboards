'use client';

import React from 'react';
import Skeleton from '@/components/ui/Skeleton';
import styles from '@/app/red/Scoreboard.module.css';

const ScoreboardSkeleton = ({ count = 4 }: { count?: number }) => {
  return (
    <div className={styles.scoreboardWrap}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.scoreboardCard} style={{ cursor: 'default' }}>
           <div className={styles.cardHeader}>
             <Skeleton width="60px" height="11px" borderRadius="3px" />
           </div>
           <div style={{ marginTop: '8px' }}>
              <Skeleton width="80px" height="24px" borderRadius="6px" />
           </div>
        </div>
      ))}
    </div>
  );
};

export default ScoreboardSkeleton;
