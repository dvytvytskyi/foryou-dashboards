'use client';

import React from 'react';
import DashboardPage from '@/components/DashboardPage';

const PROJECTS_COLUMNS = [
  { key: 'channel', label: 'Primary Plus leads' },
  { key: 'budget', label: 'Budget' },
  { key: 'leads', label: 'Leads' },
  { key: 'cpl', label: 'CPL' },
  { key: 'date', label: 'Дата' },
];

export default function PrimaryPlusPage() {
  return (
    <DashboardPage 
      title="Property Finder - Primary Plus (by Districts)"
      initialSourceFilter="all" 
      hideSourceFilter={true}
      firstColumnLabel="Primary Plus leads"
      customColumns={PROJECTS_COLUMNS}
      apiUrl="/api/pf-projects"
      maxDrilldownLevel={3}
      initialExpanded={['Primary Plus leads']}
      tableMinWidth="0px"
      defaultChannelWidth={400}
    >
      {/* Grouping: District -> Project -> Month */}
    </DashboardPage>
  );
}
