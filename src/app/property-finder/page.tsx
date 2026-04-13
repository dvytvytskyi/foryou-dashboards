'use client';

import React from 'react';
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
  return (
    <DashboardPage 
      title="Property Finder Listings Performance"
      initialSourceFilter="all" 
      hideSourceFilter={true}
      hideTotal={true}
      firstColumnLabel="Listings"
      customColumns={PF_COLUMNS}
      apiUrl="/api/pf-listings"
      maxDrilldownLevel={3}
      initialExpanded={['Property Finder']}
      tableMinWidth="0px"
      defaultChannelWidth={400}
    >
      <div style={{ marginTop: '40px' }}>
        <DashboardPage 
          title="Property Finder Primary Plus (By Districts)"
          isNested={true}
          hideFilters={true}
          hideTotal={false}
          firstColumnLabel="Primary Plus leads"
          customColumns={PROJECT_COLUMNS}
          apiUrl="/api/pf-projects"
          maxDrilldownLevel={3}
          initialExpanded={['Primary Plus leads']}
          tableMinWidth="0px"
          defaultChannelWidth={400}
        />
      </div>
    </DashboardPage>
  );
}
