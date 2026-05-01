'use client';

import DashboardPage, { MARKETING_COLUMNS } from '@/components/DashboardPage';
import MarketingFilters from '@/components/dashboard/filters/MarketingFilters';

// Partners leads are shown in the separate section below — exclude from main table
const MAIN_CHANNELS = ['RED', 'Facebook', 'Klykov', 'Website', 'ЮрийНедвижБош', 'Own leads'];

export default function MarketingPage() {
  return (
    <DashboardPage 
      title="Marketing Analytics" 
      customColumns={MARKETING_COLUMNS} 
      FilterComponent={MarketingFilters}
      showDataStatus={true}
      queryChannels={MAIN_CHANNELS}
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
      />
    </DashboardPage>
  );
}

