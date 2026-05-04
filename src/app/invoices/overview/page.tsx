'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardPage from '@/components/DashboardPage';
import { InvoiceCard, InvoicesTable, InvoicesSkeleton } from './InvoicesUI';
import styles from './invoices.module.css';

type InvoicesOverviewData = {
  short: {
    totalCommission: number;
    invoiceCount: number;
    companyRemainder: number;
    tableRows: any[];
  };
  long: {
    totalCommission: number;
    invoiceCount: number;
    companyRemainder: number;
    tableRows: any[];
  };
};

const EMPTY_DATA: InvoicesOverviewData = {
  short: {
    totalCommission: 0,
    invoiceCount: 0,
    companyRemainder: 0,
    tableRows: [],
  },
  long: {
    totalCommission: 0,
    invoiceCount: 0,
    companyRemainder: 0,
    tableRows: [],
  },
};

export default function InvoicesOverviewPage() {
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState<'aed' | 'usd'>('usd');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<InvoicesOverviewData>(EMPTY_DATA);
  const [tableTab, setTableTab] = useState<'short' | 'long'>('short');

  const [dateRange, setDateRange] = useState(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('dashboard-startDate');
      const e = localStorage.getItem('dashboard-endDate');
      if (s && e) return { startDate: s, endDate: e };
    }
    return {
      startDate: '2024-01-01',
      endDate: new Date().toISOString().split('T')[0],
    };
  });

  const fetchData = useCallback(async (start: string, end: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/invoices/overview?startDate=${start}&endDate=${end}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load invoices data');
      setData(json.data || EMPTY_DATA);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invoices data');
      setData(EMPTY_DATA);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(dateRange.startDate, dateRange.endDate);
  }, [dateRange, fetchData]);

  const handleDateChange = (startDate: string, endDate: string) => {
    setDateRange({ startDate, endDate });
  };

  const currentTableRows = tableTab === 'short' ? data.short.tableRows : data.long.tableRows;

  return (
    <DashboardPage
      title="Инвойсы: Обзор"
      hideTable={true}
      onDateChange={handleDateChange}
      currency={currency}
      setCurrency={setCurrency}
      hideSourceFilter={true}
      layoutVariant="red"
    >
      <div className={styles.container}>
        {loading ? (
          <InvoicesSkeleton />
        ) : error ? (
          <div className={styles.tableContainer} style={{ padding: '16px', color: 'var(--muted)' }}>
            Ошибка загрузки: {error}
          </div>
        ) : (
          <>
            <div className={styles.kpiGrid}>
              <InvoiceCard 
                title="Общая сумма комиссии (шорт)" 
                value={data.short.totalCommission} 
                isMoney={true} 
                currency={currency} 
              />
              <InvoiceCard 
                title="Кол-во Инвойсов (шорт)" 
                value={data.short.invoiceCount} 
              />
              <InvoiceCard 
                title="Останется на компании (шорт)" 
                value={data.short.companyRemainder} 
                isMoney={true} 
                currency={currency} 
              />
              
              <InvoiceCard 
                title="Общая сумма комиссии (лонг)" 
                value={data.long.totalCommission} 
                isMoney={true} 
                currency={currency} 
              />
              <InvoiceCard 
                title="Кол-во Инвойсов (лонг)" 
                value={data.long.invoiceCount} 
              />
              <InvoiceCard 
                title="Останется на компании (лонг)" 
                value={data.long.companyRemainder} 
                isMoney={true} 
                currency={currency} 
              />
            </div>

            <InvoicesTable 
              title="Список инвойсов" 
              rows={currentTableRows} 
              currency={currency} 
              activeTab={tableTab}
              setActiveTab={setTableTab}
            />
          </>
        )}
      </div>
    </DashboardPage>
  );
}
