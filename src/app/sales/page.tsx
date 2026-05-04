'use client';

import React, { useEffect, useState } from 'react';
import DashboardPage from '@/components/DashboardPage';
import { 
  SalesScoreboard, 
  ProfitBarChart, 
  BrokerKpiTable, 
  DealTypeStackedBar, 
  DepartmentBreakdown, 
  SupportSection, 
  PartnersTable,
  DealsModal,
  SalesDashboardSkeleton
} from './OverviewUI';
import styles from './sales.module.css';

import RedFilters from '@/components/dashboard/filters/RedFilters';

export default function SalesOverviewPage() {
  const [syncTheme, setSyncTheme] = useState<'light' | 'night' | null>(null);
  const [currency, setCurrency] = useState<'usd' | 'aed'>('usd');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('dashboard-startDate');
      const e = localStorage.getItem('dashboard-endDate');
      if (s && e) return { startDate: s, endDate: e };
    }
    return { 
      startDate: '2024-01-01', 
      endDate: new Date().toISOString().split('T')[0] 
    };
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
      FilterComponent={RedFilters}
      externalThemeMode={syncTheme}
      onThemeChange={setSyncTheme}
      currency={currency}
      setCurrency={setCurrency}
    >
      <div className={styles.container}>
        {loading ? (
          <SalesDashboardSkeleton />
        ) : error ? (
          <div className={styles.error}>Ошибка: {error}</div>
        ) : data ? (
          <>
            <SalesScoreboard 
              data={data.scoreboard} 
              currency={currency}
              onClick={(metric) => {
                setActiveMetric(metric);
                setIsModalOpen(true);
              }} 
            />
            
            {/* Ряд 1: Распределение + Сопровождение */}
            <div className={styles.visualsGrid}>
              <DealTypeStackedBar data={data.types} />
              <SupportSection data={data.support} currency={currency} />
            </div>
            {/* Ряд 2: Доходность по источникам + Топ брокеров */}
            <div className={styles.visualsGrid}>
              <DepartmentBreakdown data={data.departments} currency={currency} />
              <ProfitBarChart brokers={data.brokers} currency={currency} />
            </div>

            {/* Ряд 3: Партнеры + KPI брокеров */}
            <div className={styles.topGrid}>
              <PartnersTable partners={data.partners} currency={currency} />
              <BrokerKpiTable brokers={data.brokers} currency={currency} />
            </div>

            <DealsModal 
              isOpen={isModalOpen} 
              onClose={() => setIsModalOpen(false)} 
              deals={data.deals || []} 
              currency={currency}
              highlightMetric={activeMetric}
            />
          </>
        ) : null}
      </div>
    </DashboardPage>
  );
}
