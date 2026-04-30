'use client';

import DashboardPage, { MARKETING_COLUMNS } from '@/components/DashboardPage';
import MarketingFilters from '@/components/dashboard/filters/MarketingFilters';

export default function MarketingPage() {
  return (
    <DashboardPage 
      title="Marketing Analytics" 
      customColumns={MARKETING_COLUMNS} 
      FilterComponent={MarketingFilters}
      showDataStatus={true}
    />
  );
}
