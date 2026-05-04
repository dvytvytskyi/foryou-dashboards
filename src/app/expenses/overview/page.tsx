'use client';

import React, { useState, useCallback, useEffect } from 'react';
import DashboardPage from '@/components/DashboardPage';
import { IncomeTable, SummaryTable, ExpenseDetailsTable, ExpensesSkeleton } from './ExpensesUI';
import styles from './expenses.module.css';

type IncomeRow = {
  type: string;
  deals: number;
  income: number;
  isTotal?: boolean;
};

type SummaryRow = {
  category: string;
  amount: number;
};

type ExpenseDetailRow = {
  name: string;
  current: number;
  mom: number;
  qoq: number;
  yoy: number;
  average: number;
  isTotal?: boolean;
  isResult?: boolean;
};

type ExpensesOverviewPayload = {
  incomeRows: IncomeRow[];
  summaryRows: SummaryRow[];
  expenseDetails: ExpenseDetailRow[];
  result: number;
};

const EMPTY_DATA: ExpensesOverviewPayload = {
  incomeRows: [],
  summaryRows: [],
  expenseDetails: [],
  result: 0,
};

export default function ExpensesOverviewPage() {
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState<'aed' | 'usd'>(() => {
    try { return (localStorage.getItem('dashboard-currency') as 'aed' | 'usd') || 'aed'; } catch { return 'aed'; }
  });
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExpensesOverviewPayload>(EMPTY_DATA);

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
      const res = await fetch(`/api/expenses/overview?startDate=${start}&endDate=${end}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load expenses overview');

      setData({
        incomeRows: json.data?.incomeRows || [],
        summaryRows: json.data?.summaryRows || [],
        expenseDetails: json.data?.expenseDetails || [],
        result: Number(json.data?.result || 0),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load expenses overview');
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

  return (
    <DashboardPage
      title="Расходы: Обзор"
      hideTable={true}
      onDateChange={handleDateChange}
      currency={currency}
      setCurrency={setCurrency}
      hideSourceFilter={true}
      layoutVariant="red"
    >
      <div className={styles.container}>
        {loading ? (
          <ExpensesSkeleton />
        ) : error ? (
          <div className={styles.tableContainer} style={{ padding: '16px', color: 'var(--muted)' }}>
            Ошибка загрузки: {error}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <IncomeTable rows={data.incomeRows} currency={currency} />
              <SummaryTable rows={data.summaryRows} result={data.result} currency={currency} />
            </div>
            
            <ExpenseDetailsTable categories={data.expenseDetails} currency={currency} />
          </>
        )}
      </div>
    </DashboardPage>
  );
}
