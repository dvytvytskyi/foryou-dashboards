'use client';

import React, { useState } from 'react';
import Scoreboard, { ScoreboardData } from './Scoreboard';
import { DashboardPage, RED_COLUMNS_MAIN, RED_COLUMNS_GEO } from '../marketing/page';

const mockScoreboard: ScoreboardData = {
  leads: 1200,
  ql: 340,
  cpql: 'AED 85',
  spend: 'AED 102,000',
  revenue: 'AED 888,888',
};


export default function RedPage() {
  const [syncTheme, setSyncTheme] = useState<'light' | 'night' | null>(null);

  return (
    <DashboardPage
      title="Red Leads"
      initialSourceFilter="RED"
      hideSourceFilter={true}
      customColumns={RED_COLUMNS_MAIN}
      firstColumnLabel="Источник / РК"
      extraContent={<Scoreboard data={mockScoreboard} />}
      externalThemeMode={syncTheme}
      onThemeChange={setSyncTheme}
      initialExpanded={['RED']}
      hideTotal={true}
    >
      <DashboardPage
        title="География и телефоны"
        isNested={true}
        apiUrl="/api/marketing/geo"
        hideSourceFilter={true}
        customColumns={RED_COLUMNS_GEO}
        firstColumnLabel="Категория"
        externalThemeMode={syncTheme}
        maxDrilldownLevel={2}
        defaultChannelWidth={250}
        tableMinWidth="auto"
        initialExpanded={[]}
        hideTotal={true}
      />
    </DashboardPage>
  );
}
