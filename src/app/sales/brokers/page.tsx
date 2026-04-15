'use client';

import React, { useState, useEffect } from 'react';
import DashboardPage from '@/components/DashboardPage';
import BrokersUI from './BrokersUI';
import Select from 'react-select';

export default function BrokersPage() {
  const [brokers, setBrokers] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedBroker, setSelectedBroker] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return { startDate: '2024-01-01', endDate: today };
  });

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
    <div style={{ minWidth: '220px' }}>
      <Select
        placeholder={loading ? "Загрузка..." : "Выберите брокера..."}
        options={brokers}
        isClearable={false}
        isDisabled={loading}
        value={selectedBroker}
        onChange={(val: any) => setSelectedBroker(val)}
        styles={{
          control: (base, state) => ({
            ...base,
            height: '36px',
            minHeight: '36px',
            borderRadius: '999px',
            background: 'var(--surface-input)',
            borderColor: state.isFocused ? 'var(--accent)' : 'var(--line-soft)',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
            boxShadow: 'none',
            padding: '0 8px',
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: state.isFocused ? 'var(--accent)' : 'var(--accent)',
              opacity: 0.9
            }
          }),
          singleValue: (base) => ({
            ...base,
            color: 'var(--white-soft)',
            fontFamily: 'inherit'
          }),
          placeholder: (base) => ({
            ...base,
            color: 'var(--muted)',
            fontFamily: 'inherit'
          }),
          menu: (base) => ({
            ...base,
            background: 'var(--bg-0)',
            border: '1px solid var(--line-soft)',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            zIndex: 9999,
            overflow: 'hidden',
            padding: '4px',
            animation: 'dropdownFadeIn 0.2s ease-out forwards'
          }),
          option: (base, state) => ({
            ...base,
            background: state.isSelected 
              ? 'var(--accent)' 
              : state.isFocused 
                ? 'rgba(255,255,255,0.05)' 
                : 'transparent',
            color: state.isSelected ? '#fff' : 'var(--white-soft)',
            fontSize: '13px',
            fontWeight: 500,
            padding: '8px 12px',
            borderRadius: '10px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            '&:active': {
              background: 'var(--accent)'
            }
          }),
          indicatorSeparator: () => ({ display: 'none' }),
          dropdownIndicator: (base) => ({
            ...base,
            color: 'var(--muted)',
            '&:hover': { color: 'var(--white-soft)' }
          })
        }}
      />
      <style jsx global>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );

  return (
    <DashboardPage 
      title="Брокеры" 
      hideTable={true} 
      hideSourceFilter={true} 
      hideCurrency={true}
      customFilterContent={customFilter}
      onDateChange={(start, end) => setDateRange({ startDate: start, endDate: end })}
    >
      <BrokersUI selectedBroker={selectedBroker} startDate={dateRange.startDate} endDate={dateRange.endDate} />
    </DashboardPage>
  );
}
