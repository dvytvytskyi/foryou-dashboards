import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// TODO: implement RED scoreboard data fetching
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      ql: 0,
      cpql: 0,
      spend: 0,
      revenue: 0,
      qlDeltaUnits: 0,
      cpqlDeltaPct: 0,
      spendDeltaPct: 0,
      revenueDeltaPct: 0,
    },
  });
}
