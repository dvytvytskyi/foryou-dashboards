'use client';

import React from 'react';
import FilterBar from '../FilterBar';
import { MARKETING_CHANNELS } from '@/components/DashboardPage';

// Shared styling tokens/common parts are in FilterBar, 
// but this component defines the 'Marketing' specific layout (2 rows)
const MarketingFilters: React.FC<any> = (props) => {
  return (
    <FilterBar 
      {...props} 
      sourceChannels={MARKETING_CHANNELS}
      layoutVariant="marketing" // 2 rows: Source/Currency + Dates
    />
  );
};

export default MarketingFilters;
