"use client";

import React, { useEffect, useState } from 'react';
import DashboardPage from '@/components/DashboardPage';
import PlanFactUI from './PlanFactUI';

export default function PlanFactPage() {
  const [currency, setCurrency] = useState<'usd' | 'aed'>('aed');
  
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('dashboard-startDate');
      const e = localStorage.getItem('dashboard-endDate');
      if (s && e) return { startDate: s, endDate: e };
    }
    const today = new Date().toISOString().slice(0, 10);
    return { startDate: '2026-05-01', endDate: today };
  });

  useEffect(() => {
    const storedCurrency = typeof window !== 'undefined' ? localStorage.getItem('dashboard-currency') : null;
    if (storedCurrency === 'usd' || storedCurrency === 'aed') {
      setCurrency(storedCurrency as 'usd' | 'aed');
    }
  }, []);

  return (
    <DashboardPage
      title="План / Факт"
      hideTable={true}
      hideSourceFilter={true}
      currency={currency}
      setCurrency={setCurrency}
      onDateChange={(start, end) => setDateRange({ startDate: start, endDate: end })}
      datePresetMode="plan-fact-months"
    >
      <PlanFactUI startDate={dateRange.startDate} endDate={dateRange.endDate} />
    </DashboardPage>
  );
}
