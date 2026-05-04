'use client';

import React, { useMemo, useState } from 'react';
import DashboardPage from '@/components/DashboardPage';
import RedFilters from '@/components/dashboard/filters/RedFilters';

type Currency = 'aed' | 'usd';

const PF_COLUMNS = [
  { key: 'channel', label: 'Listings' },
  { key: 'budget', label: 'Budget' },
  { key: 'date', label: 'Дата' },
  { key: 'cpl', label: 'CPL' },
  { key: 'leads', label: 'Leads' },
  { key: 'no_answer_spam', label: 'No answer / Spam' },
  { key: 'rate_answer', label: '% rate answer' },
  { key: 'qualified_leads', label: 'Qualified Leads' },
  { key: 'cost_per_qualified_leads', label: 'Cost Per Qualified' },
  { key: 'ql_actual', label: 'QL Actual' },
  { key: 'cpql_actual', label: 'CPQL Actual' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'cp_meetings', label: 'CP Meetings' },
  { key: 'deals', label: 'Deals' },
  { key: 'cost_per_deal', label: 'Cost Per Deal' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'roi', label: 'ROI' },
];

const PROJECT_COLUMNS = [
  { key: 'channel', label: 'Primary Plus leads' },
  { key: 'budget', label: 'Budget' },
  { key: 'date', label: 'Дата' },
  { key: 'cpl', label: 'CPL' },
  { key: 'leads', label: 'Leads (PF)' },
  { key: 'crm_leads', label: 'Leads (CRM)' },
  { key: 'no_answer_spam', label: 'No answer / Spam' },
  { key: 'rate_answer', label: '% rate answer' },
  { key: 'qualified_leads', label: 'Qualified Leads' },
  { key: 'cost_per_qualified_leads', label: 'Cost Per Qualified' },
  { key: 'ql_actual', label: 'QL Actual' },
  { key: 'cpql_actual', label: 'CPQL Actual' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'cp_meetings', label: 'CP Meetings' },
  { key: 'deals', label: 'Deals' },
  { key: 'cost_per_deal', label: 'Cost Per Deal' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'roi', label: 'ROI' },
];

export default function PropertyFinderPage() {
  const [syncTheme, setSyncTheme] = useState<'light' | 'night' | null>(null);
  const [currency, setCurrency] = useState<Currency>(() => {
    try { return (localStorage.getItem('dashboard-currency') as Currency) || 'aed'; } catch { return 'aed'; }
  });
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    return { startDate: '2026-04-22', endDate: today };
  });

  const ourApiUrl = useMemo(() => '/api/pf-listings?group=Our', []);

  const partnerApiUrl = useMemo(() => '/api/pf-listings?group=Partner', []);

  const nestedProjectsApiUrl = useMemo(() => '/api/pf-projects', []);

  return (
    <DashboardPage 
      title="Property Finder Listings Performance - Our"
      initialSourceFilter="all" 
      hideSourceFilter={true}
      hideTotal={true}
      firstColumnLabel="Listings"
      customColumns={PF_COLUMNS}
      apiUrl={ourApiUrl}
      maxDrilldownLevel={3}
      initialExpanded={[]}
      tableMinWidth="100%"
      defaultChannelWidth={400}
      FilterComponent={RedFilters}
      defaultStartDate="2026-04-22"
      forceDefaultDateRange={true}
      isolateLocalStorage={true}
      externalThemeMode={syncTheme}
      onThemeChange={setSyncTheme}
      onDateChange={(start, end) => setDateRange({ startDate: start, endDate: end })}
      customTableStyle={{ marginTop: '23px' }}
      showDataStatus={true}
      currency={currency}
      setCurrency={setCurrency}
    >
      <div style={{ marginTop: '0' }}>
        <DashboardPage 
          title="Property Finder Listings Performance - Partner & Abu Dhabi"
          isNested={true}
          hideFilters={true}
          hideTotal={false}
          initialSourceFilter="all"
          hideSourceFilter={true}
          firstColumnLabel="Listings"
          customColumns={PF_COLUMNS}
          apiUrl={partnerApiUrl}
          maxDrilldownLevel={3}
          initialExpanded={[]}
          tableMinWidth="100%"
          defaultChannelWidth={400}
          defaultStartDate={dateRange.startDate}
          defaultEndDate={dateRange.endDate}
          forceDefaultDateRange={true}
          externalThemeMode={syncTheme}
          customTableStyle={{ marginTop: '8px' }}
          currency={currency}
          setCurrency={setCurrency}
          hideCurrency={true}
        />
      </div>

      <div style={{ marginTop: '-4px' }}>
        <DashboardPage 
          title="Property Finder Primary Plus (By Districts)"
          isNested={true}
          hideFilters={true}
          hideTotal={false}
          firstColumnLabel="Primary Plus leads"
          customColumns={PROJECT_COLUMNS}
          apiUrl={nestedProjectsApiUrl}
          maxDrilldownLevel={3}
          initialExpanded={[]}
          tableMinWidth="100%"
          defaultChannelWidth={400}
          defaultStartDate={dateRange.startDate}
          defaultEndDate={dateRange.endDate}
          forceDefaultDateRange={true}
          externalThemeMode={syncTheme}
          customTableStyle={{ marginTop: '8px' }}
          currency={currency}
          setCurrency={setCurrency}
          hideCurrency={true}
        />
      </div>
    </DashboardPage>
  );
}

