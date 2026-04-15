'use client';

import React, { useEffect, useState } from 'react';
import DashboardPage from '@/components/DashboardPage';
import { DirectionCard, SourcePerformanceTable, DirectionsSkeleton } from './DirectionsUI';
import styles from './directions.module.css';

export default function SalesDirectionsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sales/directions');
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || 'Failed to fetch data');
      }
    } catch (e) {
      setError('Failed to fetch direction data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <DashboardPage 
      title="Отдел продаж: Направления" 
      hideTable={true}
      hideSourceFilter={true}
    >
      <div className={styles.container}>
        {loading ? (
          <DirectionsSkeleton />
        ) : error ? (
          <div style={{ color: 'var(--warn)' }}>{error}</div>
        ) : (
          <>
            <div className={styles.kpiGrid}>
              <DirectionCard title="Первичка" data={data.directions['Первичка']} />
              <DirectionCard title="Вторичка" data={data.directions['Вторичка']} />
              <DirectionCard title="Аренда" data={data.directions['Аренда']} />
              <DirectionCard title="Сопровождение" data={data.directions['Сопровождение']} />
            </div>

            <SourcePerformanceTable sources={data.sources} />
          </>
        )}
      </div>
    </DashboardPage>
  );
}
