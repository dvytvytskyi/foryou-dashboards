'use client';

import React, { useState, useCallback, useEffect } from 'react';
import DashboardPage from '@/components/DashboardPage';
import { ExpensesSummaryCard, ExpenseCategoriesTable, ExpensesSkeleton } from './ExpensesOverviewUI';
import styles from './expenses.module.css';
import RedFilters from '@/components/dashboard/filters/RedFilters';

export default function ExpensesOverviewPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'aed' | 'usd'>(() => {
    try { return (localStorage.getItem('dashboard-currency') as 'aed' | 'usd') || 'aed'; } catch { return 'aed'; }
  });
  
  const [expenseData, setExpenseData] = useState<any[]>([]);
  
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('dashboard-startDate');
      const e = localStorage.getItem('dashboard-endDate');
      if (s && e) return { startDate: s, endDate: e };
    }
    return { startDate: '2024-01-01', endDate: new Date().toISOString().split('T')[0] };
  });

  const fetchData = useCallback(async (startDate: string, endDate: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/expenses/overview?startDate=${startDate}&endDate=${endDate}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load data');
      
      setExpenseData(json.data.expenseDetails || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading data');
      setExpenseData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(dateRange.startDate, dateRange.endDate);
  }, [dateRange, fetchData]);

  const totalExpenseNode = expenseData.find(d => d.isTotal);
  const netIncomeNode = expenseData.find(d => d.isResult);

  return (
    <DashboardPage
      title="Расходы и доходы"
      hideTable={true}
      FilterComponent={RedFilters}
      onDateChange={(s, e) => setDateRange({ startDate: s, endDate: e })}
      currency={currency as any}
      setCurrency={setCurrency as any}
      hideSourceFilter={true}
      datePresetMode="expenses-months"
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
            <div className={styles.kpiGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
              <ExpensesSummaryCard data={totalExpenseNode} currency={currency} isIncome={false} />
              <ExpensesSummaryCard data={netIncomeNode} currency={currency} isIncome={true} />
            </div>
            
            <div style={{ marginTop: '16px' }}>
              <ExpenseCategoriesTable rows={expenseData} currency={currency} />
            </div>
          </>
        )}
      </div>
    </DashboardPage>
  );
}

