'use client';

import React, { useMemo, useState } from 'react';
import DashboardPage from '@/components/DashboardPage';

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

export default function PropertyFinderPage() {
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    return { startDate: '2024-01-01', endDate: today };
  });

  const nestedPartnerApiUrl = useMemo(
    () => `/api/pf-listings?group=Partner&startDate=${encodeURIComponent(dateRange.startDate)}&endDate=${encodeURIComponent(dateRange.endDate)}`,
    [dateRange.startDate, dateRange.endDate],
  );

  const nestedProjectsApiUrl = useMemo(
    () => `/api/pf-projects?startDate=${encodeURIComponent(dateRange.startDate)}&endDate=${encodeURIComponent(dateRange.endDate)}`,
    [dateRange.startDate, dateRange.endDate],
  );

  return (
    <DashboardPage 
      title="Property Finder Listings Performance - Our"
      initialSourceFilter="all" 
      hideSourceFilter={true}
      hideTotal={true}
      firstColumnLabel="Listings"
      customColumns={PF_COLUMNS}
      apiUrl="/api/pf-listings?group=Our"
      maxDrilldownLevel={3}
      initialExpanded={['Property Finder']}
      tableMinWidth="0px"
      defaultChannelWidth={400}
      onDateChange={(start, end) => setDateRange({ startDate: start, endDate: end })}
    >
      <div style={{ marginTop: '60px' }}>
        <DashboardPage 
          title="Property Finder Listings Performance - Partner"
          isNested={true}
          hideFilters={true}
          hideTotal={true}
          firstColumnLabel="Listings"
          customColumns={PF_COLUMNS}
          apiUrl={nestedPartnerApiUrl}
          maxDrilldownLevel={3}
          initialExpanded={['Property Finder']}
          tableMinWidth="0px"
          defaultChannelWidth={400}
        />
      </div>

      <div style={{ marginTop: '60px' }}>
        <DashboardPage 
          title="Property Finder Primary Plus (By Districts)"
          isNested={true}
          hideFilters={true}
          hideTotal={false}
          firstColumnLabel="Primary Plus leads"
          customColumns={PROJECT_COLUMNS}
          apiUrl={nestedProjectsApiUrl}
          maxDrilldownLevel={3}
          initialExpanded={['Primary Plus leads']}
          tableMinWidth="0px"
          defaultChannelWidth={400}
        />
      </div>
    </DashboardPage>
  );
}
