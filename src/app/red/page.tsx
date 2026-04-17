'use client';

import React, { useEffect, useState } from 'react';
import Scoreboard, { ScoreboardData } from './Scoreboard';
import DashboardPage, { RED_COLUMNS_MAIN, RED_COLUMNS_GEO } from '@/components/DashboardPage';
import RedFilters from '@/components/dashboard/filters/RedFilters';

const emptyScoreboard: ScoreboardData = {
  ql: 0,
  cpql: 0,
  spend: 0,
  revenue: 0,
  qlDeltaUnits: 0,
  cpqlDeltaPct: 0,
  spendDeltaPct: 0,
  revenueDeltaPct: 0,
};


export default function RedPage() {
  const [syncTheme, setSyncTheme] = useState<'light' | 'night' | null>(null);
  const [scoreboard, setScoreboard] = useState<ScoreboardData>(emptyScoreboard);
  const [scoreboardLoading, setScoreboardLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(() => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const s = localStorage.getItem('dashboard-startDate');
      const e = localStorage.getItem('dashboard-endDate');
      if (s && e) return { startDate: s, endDate: e };
    } catch {}
    return { startDate: '2024-01-01', endDate: today };
  });

  const geoApiUrl = `/api/marketing/geo?startDate=${encodeURIComponent(dateRange.startDate)}&endDate=${encodeURIComponent(dateRange.endDate)}`;

  useEffect(() => {
    (async () => {
      setScoreboardLoading(true);
      try {
        const res = await fetch(
          `/api/marketing/red-scoreboard?startDate=${encodeURIComponent(dateRange.startDate)}&endDate=${encodeURIComponent(dateRange.endDate)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const json = await res.json();
        if (json?.success && json?.data) {
          setScoreboard(json.data);
        }
      } catch (error) {
        console.error('Failed to fetch RED scoreboard:', error);
      } finally {
        setScoreboardLoading(false);
      }
    })();
  }, [dateRange.startDate, dateRange.endDate]);

  return (
    <DashboardPage
      title="Red Leads"
      initialSourceFilter="RED"
      queryChannels={['RED']}
      hideSourceFilter={true}
      customColumns={RED_COLUMNS_MAIN}
      firstColumnLabel="Источник / РК"
      extraContent={<Scoreboard data={scoreboard} isLoading={scoreboardLoading} />}
      FilterComponent={RedFilters}
      externalThemeMode={syncTheme}
      onThemeChange={setSyncTheme}
      initialExpanded={[]}
      hideTotal={true}
      onDateChange={(start, end) => setDateRange({ startDate: start, endDate: end })}
    >
      <DashboardPage
        title="География и телефоны"
        isNested={true}
        apiUrl={geoApiUrl}
        hideSourceFilter={true}
        hideFilters={true}
        customColumns={RED_COLUMNS_GEO}
        firstColumnLabel="Категория"
        externalThemeMode={syncTheme}
        maxDrilldownLevel={2}
        defaultChannelWidth={350}
        tableMinWidth="100%"
        hideTotal={true}
      />
    </DashboardPage>
  );
}
