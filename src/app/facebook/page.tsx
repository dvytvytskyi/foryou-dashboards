'use client';

import React, { useEffect, useState } from 'react';
import DashboardPage, { RED_COLUMNS_MAIN } from '@/components/DashboardPage';
import FacebookScoreboard, { FacebookScoreboardData } from './Scoreboard';

const emptyScoreboard: FacebookScoreboardData = {
  leads: 0,
  ql: 0,
  meetings: 0,
  deals: 0,
  revenue: 0,
};

export default function FacebookPage() {
  const [syncTheme, setSyncTheme] = useState<'light' | 'night' | null>(null);
  const [scoreboard, setScoreboard] = useState<FacebookScoreboardData>(emptyScoreboard);
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(() => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const s = localStorage.getItem('dashboard-startDate');
      const e = localStorage.getItem('dashboard-endDate');
      if (s && e) return { startDate: s, endDate: e };
    } catch {}
    return { startDate: '2024-01-01', endDate: today };
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/marketing/facebook-scoreboard?startDate=${encodeURIComponent(dateRange.startDate)}&endDate=${encodeURIComponent(dateRange.endDate)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const json = await res.json();
        if (json?.success && json?.data) {
          setScoreboard(json.data);
        }
      } catch (error) {
        console.error('Failed to fetch Facebook scoreboard:', error);
      }
    })();
  }, [dateRange.startDate, dateRange.endDate]);

  return (
    <DashboardPage
      title="Facebook / Target Point"
      initialSourceFilter="Facebook"
      hideSourceFilter={true}
      customColumns={RED_COLUMNS_MAIN}
      firstColumnLabel="Источник / РК"
      extraContent={<FacebookScoreboard data={scoreboard} />}
      externalThemeMode={syncTheme}
      onThemeChange={setSyncTheme}
      initialExpanded={['Facebook']}
      hideTotal={true}
      apiUrl="/api/marketing/facebook"
      onDateChange={(start, end) => setDateRange({ startDate: start, endDate: end })}
    />
  );
}
