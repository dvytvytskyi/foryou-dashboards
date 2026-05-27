'use client';

import React, { useState } from 'react';
import DashboardPage, { WEBSITE_COLUMNS } from '@/components/DashboardPage';
import SeoTable from './SeoTable';

export default function WebsitePage() {
  const [syncTheme, setSyncTheme] = useState<'light' | 'night' | null>(null);
  const [dates, setDates] = useState<{ start: string; end: string }>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return { start: d.toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] };
  });

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
      onDateChange={(start, end) => setDates({ start, end })}
      initialExpanded={['Organic', 'Google Ads', 'Facebook Ads']}
      maxDrilldownLevel={3}
      tableMinWidth="3800px"
    >
      {dates.start && dates.end && (
        <SeoTable startDate={dates.start} endDate={dates.end} />
      )}
    </DashboardPage>
  );
}
