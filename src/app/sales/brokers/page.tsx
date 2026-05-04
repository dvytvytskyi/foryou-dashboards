'use client';

import React, { useState, useEffect } from 'react';
import DashboardPage from '@/components/DashboardPage';
import BrokersUI from './BrokersUI';
import Select from 'react-select';

export default function BrokersPage() {
  const [brokers, setBrokers] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedBroker, setSelectedBroker] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<'usd' | 'aed'>(() => {
    try { return (localStorage.getItem('dashboard-currency') as 'usd' | 'aed') || 'aed'; } catch { return 'aed'; }
  });

  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('dashboard-startDate');
      const e = localStorage.getItem('dashboard-endDate');
      if (s && e) return { startDate: s, endDate: e };
    }
    const today = new Date().toISOString().slice(0, 10);
    return { startDate: '2024-01-01', endDate: today };
  });

  useEffect(() => {
    const storedCurrency = typeof window !== 'undefined' ? localStorage.getItem('dashboard-currency') : null; // default: aed
    if (storedCurrency === 'usd' || storedCurrency === 'aed') {
      setCurrency(storedCurrency as 'usd' | 'aed');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/sales/brokers');
        const data = await res.json();
        const brokerList = (data.brokers || []).map((b: { id: number; name: string }) => ({
          value: String(b.id),
          label: b.name,
          id: b.id,
        }));
        setBrokers(brokerList);
        if (brokerList.length > 0) {
          setSelectedBroker(brokerList[0]);
        }
      } catch (err) {
        console.error('Failed to fetch brokers:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const customFilter = (
    <div style={{ minWidth: '240px' }}>
      <Select
        placeholder={loading ? "Загрузка..." : "Выберите брокера..."}
        options={brokers}
        isClearable={false}
        isSearchable={false}
        isDisabled={loading}
        value={selectedBroker}
        onChange={(val: any) => setSelectedBroker(val)}
        styles={{
          control: (base: any, state: any) => ({
            ...base,
            height: '38px',
            minHeight: '38px',
            borderRadius: '12px',
            background: 'var(--panel-2)',
            border: state.isFocused ? '1px solid var(--accent)' : '1px solid var(--line)',
            boxShadow: 'none',
            padding: '0 14px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            '&:hover': {
              borderColor: 'var(--accent)',
            }
          }),
          valueContainer: (base: any) => ({ 
            ...base, 
            padding: '0', 
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }),
          indicatorsContainer: (base: any) => ({ 
            ...base, 
            height: '100%', 
          }),
          indicatorSeparator: () => ({ display: 'none' }),
          singleValue: (base: any) => ({
            ...base,
            margin: 0,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--white-soft)',
            fontSize: '11px',
            fontWeight: 700,
            '&::before': {
              content: '"BROKER"',
              fontSize: '9px',
              fontWeight: 700,
              color: 'var(--muted)',
              marginRight: '8px',
              textTransform: 'uppercase'
            }
          }),
          placeholder: (base: any) => ({
            ...base,
            color: 'var(--muted)',
            fontSize: '11px',
            fontWeight: 700,
            '&::before': {
              content: '"BROKER"',
              fontSize: '9px',
              fontWeight: 700,
              color: 'var(--muted)',
              marginRight: '8px',
              textTransform: 'uppercase'
            }
          }),
          menu: (base: any) => ({
            ...base,
            background: 'var(--panel-2)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            boxShadow: 'none',
            zIndex: 9999,
            overflow: 'hidden',
            marginTop: '4px',
            padding: '0'
          }),
          option: (base: any, state: any) => ({
            ...base,
            background: state.isSelected 
              ? 'rgba(255,255,255,0.05)' 
              : state.isFocused 
                ? 'var(--bg-0)' 
                : 'transparent',
            color: state.isSelected ? 'var(--white-soft)' : 'var(--muted)',
            fontSize: '11px',
            fontWeight: state.isSelected ? 700 : 500,
            padding: '10px 14px',
            cursor: 'pointer',
            borderBottom: '1px solid var(--line)',
            transition: 'all 0.1s ease',
            '&:last-child': {
              borderBottom: 'none'
            },
            '&:active': {
              background: 'var(--bg-0)'
            }
          }),
          input: (base: any) => ({ 
            ...base, 
            margin: 0, 
            padding: 0,
            color: 'var(--white-soft)',
            fontSize: '11px'
          }),
          dropdownIndicator: (base: any) => ({
            ...base,
            color: 'var(--muted)',
            padding: '0',
            '&:hover': { color: 'var(--white-soft)' }
          })
        }}
      />
    </div>
  );

  return (
    <DashboardPage 
      title="Брокеры" 
      hideTable={true} 
      hideSourceFilter={true} 
      currency={currency}
      setCurrency={setCurrency}
      customFilterContent={customFilter}
      layoutVariant="red"
      onDateChange={(start, end) => setDateRange({ startDate: start, endDate: end })}
    >
      <BrokersUI 
        selectedBroker={selectedBroker} 
        startDate={dateRange.startDate} 
        endDate={dateRange.endDate} 
      />
    </DashboardPage>
  );
}
