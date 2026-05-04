'use client';

import React, { useState, useCallback, useEffect } from 'react';
import DashboardPage from '@/components/DashboardPage';
import { AllianceTable, CompanyDealsSkeleton } from '../CompanyDealsUI';
import styles from '../company-deals.module.css';
import RedFilters from '@/components/dashboard/filters/RedFilters';
import Select from 'react-select';

type DealType = 'Все' | 'Offplan' | 'Вторичка' | 'Аренда' | 'Сопровождение';

const DEAL_TYPE_OPTIONS = [
  { value: 'Все', label: 'Все типы' },
  { value: 'Offplan', label: 'Первичка' },
  { value: 'Вторичка', label: 'Вторичка' },
  { value: 'Аренда', label: 'Аренда' },
  { value: 'Сопровождение', label: 'Сопровождение' },
];

function shouldExcludeSource(source: string): boolean {
  const normalized = String(source || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (/(^|\s)red(\s|$)/i.test(normalized)) return true;
  const excluded = new Set(['other', 'артем герасимов', 'лид pf', 'лид компании', 'никита дьяков']);
  if (excluded.has(normalized)) return true;
  if (normalized.includes('собственный') && normalized.includes('лид')) return true;
  return false;
}

export default function CompanyAlliancePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'aed' | 'usd'>(() => {
    try { return (localStorage.getItem('dashboard-currency') as 'aed' | 'usd') || 'aed'; } catch { return 'aed'; }
  });
  const [deals, setDeals] = useState<any[]>([]);
  const [dealType, setDealType] = useState<DealType>('Все');
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('dashboard-startDate');
      const e = localStorage.getItem('dashboard-endDate');
      if (s && e) return { startDate: s, endDate: e };
    }
    return { startDate: '2024-01-01', endDate: new Date().toISOString().split('T')[0] };
  });

  const fetchData = useCallback(async (startDate: string, endDate: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/sales/overview?startDate=${startDate}&endDate=${endDate}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load data');

      // All deals excluding junk sources (same exclusions as KPI totals)
      const allianceDeals = (json.deals || []).filter((d: any) => {
        return !shouldExcludeSource(d.source);
      }).map((d: any) => ({
        ...d,
        broker: d.broker || '-',
        partner: d.partner || '-',
        client: d.client || '-',
        net: Number(d.net || 0),
        gross: Number(d.gross || 0),
        gmv: Number(d.gmv || 0),
      }));

      setDeals(allianceDeals);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading data');
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(dateRange.startDate, dateRange.endDate);
  }, [dateRange, fetchData]);

  const filteredDeals = deals.filter(d => {
    if (dealType === 'Все') return true;
    return d.type === dealType;
  });

  const customFilter = (
    <div style={{ width: '190px' }}>
      <Select
        instanceId="alliance-deal-type"
        options={DEAL_TYPE_OPTIONS}
        value={DEAL_TYPE_OPTIONS.find(o => o.value === dealType)}
        onChange={(opt: any) => setDealType(opt.value)}
        isSearchable={false}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        components={{
          SingleValue: ({ children, ...props }) => (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ color: 'var(--muted)', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', lineHeight: '1' }}>ТИП</span>
              <span style={{ color: 'var(--white-soft)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', lineHeight: '1' }}>{children}</span>
            </div>
          )
        }}
        styles={{
          control: (base) => ({
            ...base,
            minHeight: 38,
            height: 38,
            borderRadius: 12,
            background: 'var(--panel-2)',
            border: '1px solid var(--line)',
            boxShadow: 'none',
            padding: '0 12px 0 14px', // Tighter right padding
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '2px' // Reduced gap to indicators
          }),
          valueContainer: (base) => ({ 
            ...base, 
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            gap: '4px'
          }),
          indicatorSeparator: () => ({ display: 'none' }),
          dropdownIndicator: (base) => ({
            ...base,
            padding: 0,
            color: 'var(--muted)',
            '& svg': { width: 12, height: 12 } // Smaller arrow
          }),
          menu: (base) => ({
            ...base,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
            marginTop: '8px',
            zIndex: 999999
          }),
          menuPortal: (base) => ({ ...base, zIndex: 999999 }),
          option: (base, state) => ({
            ...base,
            fontSize: '11px',
            fontWeight: 500,
            padding: '10px 18px',
            backgroundColor: state.isSelected
              ? '#f1f5f9'
              : state.isFocused
                ? '#f8fafc'
                : 'transparent',
            color: '#1a1d21',
            cursor: 'pointer',
            borderBottom: '1px solid #f1f5f9',
            '&:last-child': { borderBottom: 'none' },
            '&:active': { background: '#f1f5f9' }
          })
        }}
      />
    </div>
  );

  return (
    <DashboardPage
      title="Сделки компании: Альянс"
      hideTable={true}
      FilterComponent={RedFilters}
      onDateChange={(s, e) => setDateRange({ startDate: s, endDate: e })}
      currency={currency as any}
      setCurrency={setCurrency as any}
      hideSourceFilter={true}
      customFilterContent={customFilter}
    >
      <div className={styles.container}>
        {loading ? (
          <CompanyDealsSkeleton />
        ) : error ? (
          <div className={styles.section}>Ошибка: {error}</div>
        ) : (
          <AllianceTable rows={filteredDeals} currency={currency} />
        )}
      </div>
    </DashboardPage>
  );
}
