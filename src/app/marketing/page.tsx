'use client';

import { useEffect, useState } from 'react';
import DashboardPage, { MARKETING_COLUMNS } from '@/components/DashboardPage';
import MarketingFilters from '@/components/dashboard/filters/MarketingFilters';
import MarketingKpiTable from '@/components/dashboard/MarketingKpiTable';

type Currency = 'aed' | 'usd';

// Partners leads are shown in the separate section below — exclude from main table
const MAIN_CHANNELS = ['RED', 'Facebook', 'Klykov', 'Website', 'ЮрийНедвижБош', 'Own leads'];

export default function MarketingPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [currency, setCurrency] = useState<Currency>(() => {
    try { return (localStorage.getItem('dashboard-currency') as Currency) || 'aed'; } catch { return 'aed'; }
  });
  const [marketingStartDate, setMarketingStartDate] = useState<string>('2026-01-01');
  const [marketingEndDate, setMarketingEndDate] = useState<string>(today);

  useEffect(() => {
    try {
      const savedStart = localStorage.getItem('dashboard-startDate');
      const savedEnd = localStorage.getItem('dashboard-endDate');
      if (savedStart && savedStart >= '2026-01-01') setMarketingStartDate(savedStart);
      if (savedEnd) setMarketingEndDate(savedEnd);
    } catch {
      // ignore
    }
  }, []);

  return (
    <DashboardPage 
      title="Marketing Analytics" 
      customColumns={MARKETING_COLUMNS} 
      FilterComponent={MarketingFilters}
      showDataStatus={true}
      queryChannels={MAIN_CHANNELS}
      currency={currency}
      setCurrency={setCurrency}
      onDateChange={(start, end) => {
        setMarketingStartDate(start);
        setMarketingEndDate(end);
      }}
      renderSummary={(rows) => (
        <MarketingKpiTable 
          rows={rows} 
          startDate={marketingStartDate} 
          endDate={marketingEndDate} 
        />
      )}
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
        defaultStartDate={marketingStartDate}
        defaultEndDate={marketingEndDate}
        forceDefaultDateRange={true}
        currency={currency}
        setCurrency={setCurrency}
      />
    </DashboardPage>
  );
}

