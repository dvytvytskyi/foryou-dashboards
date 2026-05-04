"use client";

import React, { useState } from 'react';
import DashboardPage from '@/components/DashboardPage';
import PlanFactUI from './PlanFactUI';

export default function PlanFactPage() {
  const [currency, setCurrency] = useState<'usd' | 'aed'>(() => {
    try { return (localStorage.getItem('dashboard-currency') as 'usd' | 'aed') || 'aed'; } catch { return 'aed'; }
  });
  
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>({
    startDate: '2026-05-01',
    endDate: '2026-05-31',
  });

  return (
    <DashboardPage
      title="План / Факт"
      hideTable={true}
      hideSourceFilter={true}
      currency={currency}
      setCurrency={setCurrency}
      onDateChange={(start, end) => setDateRange({ startDate: start, endDate: end })}
      datePresetMode="plan-fact-months"
      defaultStartDate="2026-05-01"
      defaultEndDate="2026-05-31"
      forceDefaultDateRange={true}
      layoutVariant="red"
    >
      <PlanFactUI startDate={dateRange.startDate} endDate={dateRange.endDate} />
    </DashboardPage>
  );
}
