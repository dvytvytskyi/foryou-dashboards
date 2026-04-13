'use client';

import DashboardPage, { MARKETING_COLUMNS } from '@/components/DashboardPage';

export default function MarketingPage() {
  return <DashboardPage title="Marketing Analytics" customColumns={MARKETING_COLUMNS} />;
}
