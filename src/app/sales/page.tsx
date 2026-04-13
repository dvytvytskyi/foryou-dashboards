'use client';

import React, { useEffect, useState } from 'react';
import DashboardPage from '@/components/DashboardPage';
import { SalesScoreboard, ProfitBarChart, BrokerKpiTable } from './OverviewUI';
import styles from './sales.module.css';

export default function SalesOverviewPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ 
    startDate: '2024-01-01', 
    endDate: new Date().toISOString().split('T')[0] 
  });

  const fetchData = async (start: string, end: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sales/overview?startDate=${start}&endDate=${end}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error);
      }
    } catch (e) {
      setError('Failed to fetch sales data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(dateRange.startDate, dateRange.endDate);
  }, [dateRange]);

  const handleDateChange = (start: string, end: string) => {
    setDateRange({ startDate: start, endDate: end });
  };

  return (
    <DashboardPage 
      title="Отдел продаж: Обзор"
      hideTable={true}
      hideSourceFilter={true}
      onDateChange={handleDateChange}
    >
      <div className={styles.container}>
        {loading && !data ? (
          <div className={styles.loading}>Загрузка данных по продажам...</div>
        ) : error ? (
          <div className={styles.error}>Ошибка: {error}</div>
        ) : data ? (
          <>
            <SalesScoreboard data={data.scoreboard} />
            
            <div className={styles.topGrid}>
              <ProfitBarChart brokers={data.brokers} />
              <BrokerKpiTable brokers={data.brokers} />
            </div>
          </>
        ) : null}
      </div>
    </DashboardPage>
  );
}
