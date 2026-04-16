'use client';

import React from 'react';
import Skeleton from '@/components/ui/Skeleton';
import styles from '@/components/dashboard/DataTable.module.css';

const TableSkeleton = ({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) => {
  return (
    <div style={{ padding: '0 32px', width: '100%' }}>
      <div style={{ borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--panel)', overflow: 'hidden' }}>
        {/* Header Skeleton */}
        <div style={{ height: '44px', borderBottom: '1px solid var(--line)', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          {Array.from({ length: cols }).map((_, i) => (
             <Skeleton key={i} width={i === 0 ? "140px" : "80px"} height="14px" borderRadius="4px" />
          ))}
        </div>
        
        {/* Content Skeletons */}
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} style={{ height: '48px', borderBottom: r === rows - 1 ? 'none' : '1px solid var(--line-soft)', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
             {Array.from({ length: cols }).map((_, i) => (
                <Skeleton key={i} width={i === 0 ? "180px" : "60px"} height="12px" borderRadius="3px" style={{ opacity: 0.7 - (i * 0.05) }} />
             ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TableSkeleton;
