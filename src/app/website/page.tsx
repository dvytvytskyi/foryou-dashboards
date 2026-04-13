'use client';

import React, { useState } from 'react';
import DashboardPage, { WEBSITE_COLUMNS } from '@/components/DashboardPage';

export default function WebsitePage() {
  const [syncTheme, setSyncTheme] = useState<'light' | 'night' | null>(null);

  return (
    <DashboardPage 
      title="Website Traffic & Conversions"
      apiUrl="/api/marketing/website"
      initialSourceFilter="all" 
      hideSourceFilter={true}
      customColumns={WEBSITE_COLUMNS}
      firstColumnLabel="Группировка / UTM Source"
      externalThemeMode={syncTheme}
      onThemeChange={setSyncTheme}
      initialExpanded={['Organic', 'Google Ads', 'Facebook Ads']}
      maxDrilldownLevel={3}
      tableMinWidth="3800px"
    />
  );
}
