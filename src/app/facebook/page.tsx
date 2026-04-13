'use client';

import React, { useState } from 'react';
import Scoreboard, { ScoreboardData } from '../red/Scoreboard';
import { DashboardPage, RED_COLUMNS_MAIN, RED_COLUMNS_GEO } from '../marketing/page';
const mockScoreboard: ScoreboardData = {
  leads: 0,
  ql: 0,
  cpql: 'AED 0',
  spend: 'AED 0',
  revenue: 'AED 0',
};

const mockUAEData: any[] = [];


export default function FacebookPage() {
  const [syncTheme, setSyncTheme] = useState<'light' | 'night' | null>(null);

  return (
    <DashboardPage 
      title="Facebook Leads"
      initialSourceFilter="Facebook" 
      hideSourceFilter={true}
      hideTable={true}
      customColumns={RED_COLUMNS_MAIN}
      firstColumnLabel="Источник / РК"
      extraContent={<Scoreboard data={mockScoreboard} />}
      externalThemeMode={syncTheme}
      onThemeChange={setSyncTheme}
      initialExpanded={['Facebook']}
    >
    </DashboardPage>
  );
}
