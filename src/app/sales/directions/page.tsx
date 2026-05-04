'use client';

import React, { useEffect, useState } from 'react';
import DashboardPage from '@/components/DashboardPage';
import { DirectionCard, SourcePerformanceTable, DirectionsSkeleton } from './DirectionsUI';
import styles from './directions.module.css';
import RedFilters from '@/components/dashboard/filters/RedFilters';

export default function SalesDirectionsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'aed' | 'usd'>(() => {
    try { return (localStorage.getItem('dashboard-currency') as 'aed' | 'usd') || 'aed'; } catch { return 'aed'; }
  });
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      return {
        startDate: localStorage.getItem('dashboard-startDate') || '2024-01-01',
        endDate: localStorage.getItem('dashboard-endDate') || today,
      };
    } catch {
      return { startDate: '2024-01-01', endDate: today };
    }
  });

  const fetchData = async (start?: string, end?: string) => {
    try {
      setLoading(true);
      const url = new URL('/api/sales/directions', window.location.origin);
      if (start) url.searchParams.set('startDate', start);
      if (end) url.searchParams.set('endDate', end);
      
      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.success) {
        setData(json);
        setError(null);
      } else {
        setError(json.error || 'Failed to fetch data');
      }
    } catch (e: any) {
      setError('Failed to fetch direction data: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(dateRange.startDate, dateRange.endDate);
  }, [currency, dateRange.startDate, dateRange.endDate]);

  return (
    <DashboardPage 
      title="Отдел продаж: Направления" 
      hideTable={true}
      FilterComponent={RedFilters}
      onDateChange={(start, end) => setDateRange({ startDate: start, endDate: end })}
      currency={currency as any}
      setCurrency={setCurrency as any}
      hideSourceFilter={true}
    >
      <div className={styles.container}>
        {loading && !data ? (
          <DirectionsSkeleton />
        ) : error ? (
          <div style={{ color: 'var(--warn)', padding: '20px' }}>{error}</div>
        ) : data ? (
          <>
            <div className={styles.kpiGrid}>
              <DirectionCard title="Первичка" data={data.directions['Первичка']} currency={currency} />
              <DirectionCard title="Вторичка" data={data.directions['Вторичка']} currency={currency} />
              <DirectionCard title="Аренда" data={data.directions['Аренда']} currency={currency} />
              <DirectionCard title="Сопровождение" data={data.directions['Сопровождение']} currency={currency} />
            </div>

            <SourcePerformanceTable sources={data.sources} currency={currency} />
          </>
        ) : null}
      </div>
    </DashboardPage>
  );
}
