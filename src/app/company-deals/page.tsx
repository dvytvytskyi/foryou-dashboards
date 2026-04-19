'use client';

import React, { useState } from 'react';
import DashboardPage from '@/components/DashboardPage';
import { CompanyDealCard, CompanyDealsTable, CompanyDealsSkeleton } from './CompanyDealsUI';
import styles from './company-deals.module.css';
import RedFilters from '@/components/dashboard/filters/RedFilters';

type DealType = 'Offplan' | 'Вторичка' | 'Аренда' | 'Сопровождение';

type DealRow = {
  type?: DealType;
  gmv?: number;
  gross?: number;
  net?: number;
  source?: string;
};

type OverviewResponse = {
  success: boolean;
  scoreboard?: {
    closed_deals?: number;
    gmv?: number;
    gross_commission?: number;
    net_profit?: number;
  };
  deals?: DealRow[];
  error?: string;
};

type SummaryCardData = {
  deals: number;
  gmv: number;
  gross: number;
  net: number;
};

function emptySummary(): SummaryCardData {
  return { deals: 0, gmv: 0, gross: 0, net: 0 };
}

function buildTypeSummary(deals: DealRow[] = []) {
  const total = emptySummary();
  const perType: Record<DealType, SummaryCardData> = {
    Offplan: emptySummary(),
    Вторичка: emptySummary(),
    Аренда: emptySummary(),
    Сопровождение: emptySummary(),
  };

  for (const deal of deals) {
    const gmv = Number(deal.gmv || 0);
    const gross = Number(deal.gross || 0);
    const net = Number(deal.net || 0);

    total.deals += 1;
    total.gmv += gmv;
    total.gross += gross;
    total.net += net;

    const type = deal.type;
    if (type && perType[type]) {
      perType[type].deals += 1;
      perType[type].gmv += gmv;
      perType[type].gross += gross;
      perType[type].net += net;
    }
  }

  return {
    total,
    perType,
  };
}

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

function buildSourceRows(deals: DealRow[] = []) {
  const sourceMap = new Map<string, { revenue: number; count: number }>();

  for (const deal of deals) {
    const label = normalizeSourceLabel(String(deal.source || ''));
    if (label === '__exclude__') continue;

    const current = sourceMap.get(label) || { revenue: 0, count: 0 };
    current.revenue += Number(deal.net || 0);
    current.count += 1;
    sourceMap.set(label, current);
  }

  const total = Array.from(sourceMap.values()).reduce((acc, item) => acc + item.revenue, 0);

  return Array.from(sourceMap.entries())
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      revenue: stats.revenue,
      share: total > 0 ? Math.round((stats.revenue / total) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export default function CompanyDealsSummaryPage() {
  const [syncTheme, setSyncTheme] = React.useState<'light' | 'night' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'aed' | 'usd'>('aed');
  const [summary, setSummary] = useState(() => ({
    total: emptySummary(),
    perType: {
      Offplan: emptySummary(),
      Вторичка: emptySummary(),
      Аренда: emptySummary(),
      Сопровождение: emptySummary(),
    } as Record<DealType, SummaryCardData>,
  }));
  const [rows, setRows] = useState<Array<{ name: string; count: number; share: number; revenue: number }>>([]);
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('dashboard-startDate');
      const e = localStorage.getItem('dashboard-endDate');
      if (s && e) return { startDate: s, endDate: e };
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
        throw new Error(json.error || 'Failed to load company deals data');
      }

      const filteredDeals = (json.deals || []).filter((deal) => !shouldExcludeSource(String(deal.source || '')));
      const typeSummary = buildTypeSummary(filteredDeals);
      setSummary(typeSummary);
      setRows(buildSourceRows(filteredDeals));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load company deals data');
      setSummary({
        total: emptySummary(),
        perType: {
          Offplan: emptySummary(),
          Вторичка: emptySummary(),
          Аренда: emptySummary(),
          Сопровождение: emptySummary(),
        },
      });
      setRows([]);
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
      title="Сделки компании: Итоги"
      hideTable={true}
      FilterComponent={RedFilters}
      onDateChange={handleDateChange}
      externalThemeMode={syncTheme}
      onThemeChange={setSyncTheme}
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
            <div className={styles.kpiGrid}>
              <CompanyDealCard title="Общий итог" data={summary.total} currency={currency} />
              <CompanyDealCard title="Первичка" data={summary.perType.Offplan} currency={currency} />
              <CompanyDealCard title="Вторичка" data={summary.perType.Вторичка} currency={currency} />
              <CompanyDealCard title="Аренда" data={summary.perType.Аренда} currency={currency} />
              <CompanyDealCard title="Сопровождение" data={summary.perType.Сопровождение} currency={currency} />
            </div>

            <CompanyDealsTable title="Доходность по источникам" rows={rows} currency={currency} />
          </>
        )}
      </div>
    </DashboardPage>
  );
}
