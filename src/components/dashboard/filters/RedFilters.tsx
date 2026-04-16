'use client';

import React from 'react';
import FilterBar from '../FilterBar';

// Red filters specific layout (1 row)
const RedFilters: React.FC<any> = (props) => {
  return (
    <FilterBar 
      {...props} 
      hideSourceFilter={true}
      layoutVariant="red" // 1 row: Dates + Currency at far right
    />
  );
};

export default RedFilters;
