import { NextRequest, NextResponse } from 'next/server';
import { queryPostgres } from '@/lib/postgres';
import { readPlanDataFromSheets } from '@/lib/sheets/planReader';

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

function normalizeDepartmentSource(source: string): string {
  const v = (source || '').trim().toLowerCase();
  if (!v || v === '-' || v === 'null') return 'Own leads';
  if (v.includes('property finder') || v.includes('pf') || v.includes('primary plus')) return 'Property Finder';
  if (v.includes('partner') || v.includes('partnership') || v.includes('партнер')) return 'Партнеры';
  if (v.includes('support') || v.includes('сопров')) return 'Сопровождение';
  if (v.includes('red')) return 'RED';
  if (v.includes('klykov')) return 'Klykov';
  if (v.includes('facebook') || v.includes('target point') || v.includes('oman')) return 'Facebook';
  return source;
}

function normalizeBrokerKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim();
}

// Maps normalized DB broker names → normalized plan broker names (for mismatched representations)
const BROKER_DB_TO_PLAN: Record<string, string> = {
  // Валерия Богданова
  'valeria bogdanova': 'валерия богданова',
  'богданова валерия': 'валерия богданова',
  // Артем Герасимов
  'артем герасимов': 'artem gerasimov',
  // Радик Погосян
  'радик погосян': 'radik pogosyan',
  'radik': 'radik pogosyan',
  'cb radik': 'radik pogosyan',
  // Диана Рустам Кызы
  'diana rustam': 'диана рустам кызы',
  'диана': 'диана рустам кызы',
  // Гульноза
  'гульноза': 'рахимова гульноза алишеровна',
  'gulnoza': 'рахимова гульноза алишеровна',
  // Кристина Нохрина
  'кристина': 'кристина нохрина',
  // Алексей Клыков
  'алексей клыков': 'alexey klykov',
  // Абдуллаев Руслан (reversed)
  'руслан абдуллаев': 'абдуллаев руслан',
  // Даниил Невзоров (Cyrillic)
  'даниил невзоров': 'daniil nevzorov',
  'невзоров даниил': 'daniil nevzorov',
  // Екатерина Спицына (Latin variant)
  'ekaterina spitsyna': 'екатерина спицына',
  'ekaterina spytsina': 'екатерина спицына',
  'ekaterina nbd': 'екатерина спицына',
  // Камила (Cyrillic short)
  'kamila': 'камила евстегнеева',
  'kamilla': 'камила евстегнеева',
  // Яна
  'яна': 'яна',
  'yana': 'яна',
  // Dima
  'дима': 'dima',
};

function resolveBrokerPlan(
  brokerName: string,
  brokerPlanIndex: Map<string, { lids: number; ql: number; revenue: number; deals: number }>,
) {
  const EMPTY = { lids: 0, ql: 0, revenue: 0, deals: 0 };
  const key = normalizeBrokerKey(brokerName);

  // Direct match
  if (brokerPlanIndex.has(key)) return brokerPlanIndex.get(key)!;

  // Alias lookup
  const mappedKey = BROKER_DB_TO_PLAN[key];
  if (mappedKey && brokerPlanIndex.has(mappedKey)) return brokerPlanIndex.get(mappedKey)!;

  // Partial: try first name only (single word) against plan index keys
  const firstWord = key.split(' ')[0];
  if (firstWord.length >= 4) {
    for (const [planKey, planVal] of brokerPlanIndex.entries()) {
      if (planKey.startsWith(firstWord) || planKey.includes(` ${firstWord}`)) {
        return planVal;
      }
    }
  }

  return EMPTY;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || '2024-01-01';
    const endDate = searchParams.get('endDate') || new Date().toISOString().slice(0, 10);
    const periodDate = new Date(`${endDate}T00:00:00.000Z`);
    const planByBroker = await readPlanDataFromSheets(periodDate.getUTCMonth(), periodDate.getUTCFullYear());
    const brokerPlanIndex = new Map<string, { lids: number; ql: number; revenue: number; deals: number }>();
    for (const [name, plan] of Object.entries(planByBroker || {})) {
      brokerPlanIndex.set(normalizeBrokerKey(name), {
        lids: Number(plan.lids || 0),
        ql: Number(plan.ql || 0),
        revenue: Number(plan.revenue || 0),
        deals: Number(plan.deals || 0),
      });
    }

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
      const srcKey = normalizeDepartmentSource(sourceRaw);
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

    const totalNetAbs = Math.abs(scoreboard.net_profit || 0);
    const departments = Object.entries(sourceMap)
      .map(([label, value]) => ({
        label,
        value,
        share: totalNetAbs > 0 ? Math.round((value / totalNetAbs) * 100) : 0,
        color: label === 'Property Finder' ? 'var(--white-soft)' : 'var(--muted)',
      }))
      .sort((a, b) => b.value - a.value);

    const brokers = Object.values(brokerMap).sort((a: any, b: any) => b.net_profit - a.net_profit);
    for (const broker of brokers as any[]) {
      const plan = resolveBrokerPlan(broker.broker_name, brokerPlanIndex);
      broker.plan_deals = plan.deals || 0;
      broker.plan_leads = plan.lids || 0;
      broker.plan_ql = plan.ql || 0;
      broker.plan_revenue = plan.revenue || 0;
    }
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
