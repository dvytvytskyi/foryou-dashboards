'use client';

import { useState } from 'react';
import DashboardPage, { MARKETING_COLUMNS } from '@/components/DashboardPage';
import MarketingFilters from '@/components/dashboard/filters/MarketingFilters';

type Currency = 'aed' | 'usd';

// Partners leads are shown in the separate section below — exclude from main table
const MAIN_CHANNELS = ['RED', 'Facebook', 'Klykov', 'Website', 'ЮрийНедвижБош', 'Own leads'];

export default function MarketingPage() {
  const [currency, setCurrency] = useState<Currency>(() => {
    try { return (localStorage.getItem('dashboard-currency') as Currency) || 'aed'; } catch { return 'aed'; }
  });

  return (
    <DashboardPage 
      title="Marketing Analytics" 
      customColumns={MARKETING_COLUMNS} 
      FilterComponent={MarketingFilters}
      showDataStatus={true}
      queryChannels={MAIN_CHANNELS}
      currency={currency}
      setCurrency={setCurrency}
    >
      {/* Partners section — UTM hierarchy: source → medium → campaign → content */}
      <DashboardPage
        isNested={true}
        title="Partners"
        apiUrl="/api/marketing/partners"
        customColumns={MARKETING_COLUMNS}
        maxDrilldownLevel={4}
        firstColumnLabel="UTM Source"
        showDataStatus={true}
        hideFilters={false}
        hideCurrency={true}
        defaultStartDate="2024-01-01"
        currency={currency}
        setCurrency={setCurrency}
      />
    </DashboardPage>
  );
}

