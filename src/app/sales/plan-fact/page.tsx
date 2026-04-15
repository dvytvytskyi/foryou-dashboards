"use client";

import React, { useMemo, useState } from 'react';
import DashboardPage from '@/components/DashboardPage';
import PlanFactUI from './PlanFactUI';

export default function PlanFactPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dateRange, setDateRange] = useState({ startDate: '2024-01-01', endDate: today });

  return (
    <DashboardPage
      title="План / Факт"
      hideTable={true}
      hideSourceFilter={true}
      hideCurrency={true}
      onDateChange={(start, end) => setDateRange({ startDate: start, endDate: end })}
    >
      <PlanFactUI startDate={dateRange.startDate} endDate={dateRange.endDate} />
    </DashboardPage>
  );
}
