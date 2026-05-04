'use client';

import React, { useState } from 'react';
import DashboardPage from '@/components/DashboardPage';
import { CompanyDealsSkeleton, SupportDetailsTable, BrokerRatingsTable } from '../CompanyDealsUI';
import styles from '../company-deals.module.css';
import RedFilters from '@/components/dashboard/filters/RedFilters';

type DealType = 'Offplan' | 'Вторичка' | 'Аренда' | 'Сопровождение';

type DealRow = {
  type?: DealType;
  date?: string;
  broker?: string;
  partner?: string;
  net?: number;
  gross?: number;
  gmv?: number;
  source?: string;
};

type OverviewResponse = {
  success: boolean;
  deals?: DealRow[];
  error?: string;
};

function normalizeSourceLabel(label: string): string {
  const clean = String(label || '').trim();
  const normalized = clean.toLowerCase().replace(/\s+/g, ' ');
  const hasRedWord = /(^|\s)red(\s|$)/i.test(normalized);
  const excludedLabels = new Set([
    'other',
    'артем герасимов',
    'лид pf',
    'лид компании',
    'никита дьяков',
  ]);

  if (normalized.includes('property finder')) return 'Партнеры';
  if (hasRedWord) return '__exclude__';
  if (excludedLabels.has(normalized)) return '__exclude__';
  if (normalized.includes('собственный') && normalized.includes('лид')) return '__exclude__';

  return clean || 'Other';
}

function shouldExcludeSource(label: string): boolean {
  return normalizeSourceLabel(label) === '__exclude__';
}

function normalizeSupportBrokerName(name: string): string | null {
  const normalized = String(name || '').toUpperCase().trim();
  if (normalized.includes('KRIS') || normalized.includes('КРИСТ') || normalized.includes('КРІСТ')) return 'Кристина';
  if (normalized.includes('YANA') || normalized.includes('ЯНА')) return 'Яна';
  return null;
}

function buildSupportDetailsRows(deals: DealRow[] = []) {
  const supportMap = new Map<string, {
    count: number;
    revenue: number;
    details: Array<{
      date: string;
      partner: string;
      source: string;
      revenue: number;
      gross: number;
      gmv: number;
    }>;
  }>();

  for (const deal of deals) {
    if (deal.type !== 'Сопровождение') continue;

    const brokerName = normalizeSupportBrokerName(String(deal.broker || ''));
    if (!brokerName) continue;

    const current = supportMap.get(brokerName) || { count: 0, revenue: 0, details: [] };
    current.count += 1;
    current.revenue += Number(deal.net || 0);
    current.details.push({
      date: String(deal.date || '-'),
      partner: String(deal.partner || '-'),
      source: String(deal.source || '-'),
      revenue: Number(deal.net || 0),
      gross: Number(deal.gross || 0),
      gmv: Number(deal.gmv || 0),
    });
    supportMap.set(brokerName, current);
  }

  return Array.from(supportMap.entries())
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      revenue: stats.revenue,
      details: stats.details.sort((a, b) => String(b.date).localeCompare(String(a.date))),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function buildBrokerRatingsRows(deals: DealRow[] = []) {
  const brokerMap = new Map<string, { revenue: number; deals: number; partners: Set<string> }>();

  for (const deal of deals) {
    if (shouldExcludeSource(String(deal.source || ''))) continue;

    const brokerName = String(deal.broker || '').trim();
    if (!brokerName || brokerName === '-' || brokerName.toLowerCase() === 'unknown' || brokerName.toLowerCase() === 'null') {
      continue;
    }

    const current = brokerMap.get(brokerName) || { revenue: 0, deals: 0, partners: new Set<string>() };
    current.revenue += Number(deal.net || 0);
    current.deals += 1;

    const partnerName = String(deal.partner || '').trim();
    if (partnerName && partnerName !== '-' && partnerName.toLowerCase() !== 'null') {
      current.partners.add(partnerName);
    }

    brokerMap.set(brokerName, current);
  }

  return Array.from(brokerMap.entries())
    .map(([name, stats]) => ({
      name,
      revenue: stats.revenue,
      deals: stats.deals,
      partners: stats.partners.size,
      activityValue: stats.deals,
      activityLabel: `${stats.deals} сделок / ${stats.partners.size} партнеров`,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export default function CompanyRatingsPage() {
  const [supportDetails, setSupportDetails] = useState<any[]>([]);
  const [brokerRatings, setBrokerRatings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'aed' | 'usd'>(() => {
    try { return (localStorage.getItem('dashboard-currency') as 'aed' | 'usd') || 'aed'; } catch { return 'aed'; }
  });
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(() => {
    if (typeof window !== 'undefined') {
      const startDate = localStorage.getItem('dashboard-startDate');
      const endDate = localStorage.getItem('dashboard-endDate');
      if (startDate && endDate) return { startDate, endDate };
    }

    return {
      startDate: '2024-01-01',
      endDate: new Date().toISOString().split('T')[0],
    };
  });

  const fetchData = React.useCallback(async (startDate: string, endDate: string) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/sales/overview?startDate=${startDate}&endDate=${endDate}`);
      const json: OverviewResponse = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to load ratings data');
      }

      const deals = json.deals || [];
      setSupportDetails(buildSupportDetailsRows(deals));
      setBrokerRatings(buildBrokerRatingsRows(deals));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ratings data');
      setSupportDetails([]);
      setBrokerRatings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData(dateRange.startDate, dateRange.endDate);
  }, [dateRange, fetchData]);

  const handleDateChange = (startDate: string, endDate: string) => {
    setDateRange({ startDate, endDate });
  };
  
  return (
    <DashboardPage
      title="Сделки компании: Рейтинги"
      hideTable={true}
      FilterComponent={RedFilters}
      onDateChange={handleDateChange}
      currency={currency as any}
      setCurrency={setCurrency as any}
      hideSourceFilter={true}
    >
      <div className={styles.container}>
        {loading ? (
          <CompanyDealsSkeleton />
        ) : error ? (
          <div className={styles.section}>Ошибка: {error}</div>
        ) : (
          <>
            <SupportDetailsTable rows={supportDetails} currency={currency} />
            <div style={{ height: '32px' }} />
            <BrokerRatingsTable rows={brokerRatings} currency={currency} />
          </>
        )}
      </div>
    </DashboardPage>
  );
}
