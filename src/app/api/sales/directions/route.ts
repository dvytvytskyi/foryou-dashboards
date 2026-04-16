import { NextRequest, NextResponse } from 'next/server';
import { queryPostgres } from '@/lib/postgres';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SalesDealRow = {
  deal_date: string | null;
  deal_type: string;
  source_label: string | null;
  gmv: number | string | null;
  gross: number | string | null;
  net: number | string | null;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  return Number(value) || 0;
}

function toDirectionType(dealType: string): 'Первичка' | 'Вторичка' | 'Аренда' | 'Сопровождение' | null {
  const normalized = dealType.toLowerCase();
  if (normalized === 'offplan') return 'Первичка';
  if (normalized === 'secondary') return 'Вторичка';
  if (normalized === 'rental') return 'Аренда';
  if (normalized === 'support') return 'Сопровождение';
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let startDate = searchParams.get('startDate');
    let endDate = searchParams.get('endDate');

    if (!startDate || startDate === 'undefined' || startDate === 'null') startDate = '2024-01-01';
    if (!endDate || endDate === 'undefined' || endDate === 'null') endDate = new Date().toISOString().slice(0, 10);

    const { rows } = await queryPostgres<SalesDealRow>(
      `
        SELECT deal_date, deal_type, source_label, gmv, gross, net
        FROM sales_deals_raw
        WHERE ($1::date IS NULL OR deal_date >= $1::date)
          AND ($2::date IS NULL OR deal_date <= $2::date)
        ORDER BY deal_date DESC NULLS LAST, id DESC
      `,
      [startDate, endDate],
    );

    const directions: Record<string, any> = {
      Первичка: { deals: 0, gmv: 0, revenue: 0, net: 0, total_broker_comm: 0 },
      Вторичка: { deals: 0, gmv: 0, revenue: 0, net: 0, total_broker_comm: 0 },
      Аренда: { deals: 0, gmv: 0, revenue: 0, net: 0, total_broker_comm: 0 },
      Сопровождение: { deals: 0, gmv: 0, revenue: 0, net: 0, total_broker_comm: 0 },
    };

    const sourceStats: Record<string, any> = {};

    for (const row of rows) {
      const dirKey = toDirectionType(row.deal_type);
      if (!dirKey) continue;

      const gmv = toNumber(row.gmv);
      const gross = toNumber(row.gross);
      const net = toNumber(row.net);
      const sourceRaw = (row.source_label || 'Other').trim() || 'Other';

      directions[dirKey].deals += 1;
      directions[dirKey].gmv += gmv;
      directions[dirKey].revenue += gross;
      directions[dirKey].net += net;
      directions[dirKey].total_broker_comm += gross - net;

      const srcKey = sourceRaw === '-' || sourceRaw === 'null' || !sourceRaw ? 'Other' : sourceRaw;
      if (!sourceStats[srcKey]) {
        sourceStats[srcKey] = { name: srcKey, revenue: 0, net: 0, deals: 0, expenses: 0 };
      }
      sourceStats[srcKey].revenue += gross;
      sourceStats[srcKey].net += net;
      sourceStats[srcKey].deals += 1;
    }

    Object.keys(directions).forEach((k) => {
      const d = directions[k];
      d.avg_check = d.deals > 0 ? d.gmv / d.deals : 0;
      d.broker_share = d.revenue > 0 ? d.total_broker_comm / d.revenue : 0;
    });

    if (sourceStats.Secondary) sourceStats.Secondary.expenses = 57261.95;
    if (sourceStats.RED) sourceStats.RED.expenses = 83676;
    if (sourceStats.Facebook) sourceStats.Facebook.expenses = 3281.47;
    if (sourceStats.SMM) sourceStats.SMM.expenses = 17800;

    return NextResponse.json({
      success: true,
      directions,
      sources: Object.values(sourceStats).sort((a: any, b: any) => b.revenue - a.revenue),
    });
  } catch (error) {
    console.error('Directions API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal Error' 
    }, { status: 500 });
  }
}
