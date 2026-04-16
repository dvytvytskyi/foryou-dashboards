import { NextRequest, NextResponse } from 'next/server';
import { queryPostgres } from '@/lib/postgres';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SalesDealRow = {
  source_file: string;
  row_number: number;
  deal_date: string | null;
  deal_type: string;
  broker: string | null;
  partner: string | null;
  source_label: string | null;
  gmv: number | string | null;
  gross: number | string | null;
  net: number | string | null;
  payload: Record<string, any> | null;
};

function normalizeName(name: string): string {
  const n = name.toUpperCase().trim();
  if (n.includes('KRIS') || n.includes('КРИСТ') || n.includes('КРІСТ')) return 'KRIS';
  if (n.includes('YANA') || n.includes('ЯНА')) return 'YANA';
  return n;
}

function toOverviewType(dealType: string): string {
  const normalized = dealType.toLowerCase();
  if (normalized === 'offplan') return 'Offplan';
  if (normalized === 'secondary') return 'Вторичка';
  if (normalized === 'rental') return 'Аренда';
  if (normalized === 'support') return 'Сопровождение';
  return dealType;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  return Number(value) || 0;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || '2024-01-01';
    const endDate = searchParams.get('endDate') || new Date().toISOString().slice(0, 10);

    const { rows } = await queryPostgres<SalesDealRow>(
      `
        SELECT source_file, row_number, deal_date, deal_type, broker, partner,
               source_label, gmv, gross, net, payload
        FROM sales_deals_raw
        WHERE ($1::date IS NULL OR deal_date >= $1::date)
          AND ($2::date IS NULL OR deal_date <= $2::date)
        ORDER BY deal_date DESC NULLS LAST, id DESC
      `,
      [startDate, endDate],
    );

    const scoreboard = { closed_deals: 0, gmv: 0, gross_commission: 0, net_profit: 0 };
    const brokerMap: Record<string, any> = {};
    const partnerMap: Record<string, any> = {};
    const typeMap: Record<string, number> = {};
    const sourceMap: Record<string, number> = {};
    const rawDeals: any[] = [];
    const supportMap: Record<string, any> = {
      KRIS: { name: 'Крис', deals: 0, fee: 0, revenue: 0, color: '#6366f1' },
      YANA: { name: 'Яна', deals: 0, fee: 0, revenue: 0, color: '#ec4899' },
    };

    for (const row of rows) {
      const gmv = toNumber(row.gmv);
      const gross = toNumber(row.gross);
      const net = toNumber(row.net);

      const brokerRaw = (row.broker || 'Unknown').trim() || 'Unknown';
      const brokerNormalized = normalizeName(brokerRaw);
      const displayBroker = brokerNormalized === 'KRIS' ? 'Кристина' : brokerNormalized === 'YANA' ? 'Яна' : brokerRaw;

      const partner = (row.partner || '-').trim() || '-';
      const type = toOverviewType(row.deal_type);
      const sourceRaw = (row.source_label || 'Other').trim() || 'Other';

      scoreboard.closed_deals += 1;
      scoreboard.gmv += gmv;
      scoreboard.gross_commission += gross;
      scoreboard.net_profit += net;

      if (!brokerMap[displayBroker]) {
        brokerMap[displayBroker] = { broker_name: displayBroker, gross_revenue: 0, net_profit: 0, deals: 0 };
      }
      brokerMap[displayBroker].gross_revenue += gross;
      brokerMap[displayBroker].net_profit += net;
      brokerMap[displayBroker].deals += 1;

      if (supportMap[brokerNormalized]) {
        supportMap[brokerNormalized].deals += 1;
        supportMap[brokerNormalized].fee += gross;
        supportMap[brokerNormalized].revenue += net;
      }

      if (partner !== '-' && partner !== 'Unknown' && partner !== 'null') {
        if (!partnerMap[partner]) partnerMap[partner] = { name: partner, revenue: 0, deals: 0 };
        partnerMap[partner].revenue += net;
        partnerMap[partner].deals += 1;
      }

      typeMap[type] = (typeMap[type] || 0) + net;
      const srcKey = sourceRaw === '-' || sourceRaw === 'null' ? 'Other' : sourceRaw;
      sourceMap[srcKey] = (sourceMap[srcKey] || 0) + net;

      rawDeals.push({
        date: row.deal_date || '-',
        broker: brokerRaw,
        partner,
        gmv,
        gross,
        net,
        type,
        source: sourceRaw,
        info: row.payload?.sheetName || '-',
        id: `${row.source_file}-${row.row_number}`,
      });
    }

    const totalNet = scoreboard.net_profit || 1;
    const typeColors: Record<string, string> = {
      Offplan: 'var(--white-soft)',
      Вторичка: '#94a3b8',
      Аренда: '#64748b',
      Сопровождение: '#475569',
    };

    const types = Object.entries(typeMap).map(([label, value]) => ({
      label,
      value: Math.round((value / totalNet) * 100),
      color: typeColors[label] || 'var(--muted)',
    }));

    const departments = Object.entries(sourceMap)
      .map(([label, value]) => ({
        label: label === 'PF' ? 'Property Finder' : ['PARTNERSHIP', 'PARTNER'].includes(label.toUpperCase()) ? 'Партнеры' : label,
        value,
        share: Math.round((value / totalNet) * 100),
        color: label === 'PF' ? 'var(--white-soft)' : 'var(--muted)',
      }))
      .sort((a, b) => b.value - a.value);

    const brokers = Object.values(brokerMap).sort((a: any, b: any) => b.net_profit - a.net_profit);
    const partners = Object.values(partnerMap).sort((a: any, b: any) => b.revenue - a.revenue);

    return NextResponse.json({
      success: true,
      scoreboard,
      brokers,
      partners,
      types,
      departments,
      deals: rawDeals,
      support: Object.values(supportMap),
      meta: { startDate, endDate },
    });
  } catch (error) {
    console.error('Sales Overview API error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
  }
}
