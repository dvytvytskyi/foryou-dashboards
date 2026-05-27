import { queryPostgres } from '@/lib/postgres';

export async function getDynamicPfRate(startDate: string | null, endDate: string | null): Promise<number> {
  const fallbackRate = 1.911;
  if (!startDate || !endDate) return fallbackRate;

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return fallbackRate;

    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1;
    const targetBudgetAed = 47000 * (diffDays / 30.4375);

    const { rows: listings } = await queryPostgres<{ budget_by_month: Record<string, number> | null }>(
      `SELECT budget_by_month FROM pf_listings_snapshot`, []
    );
    const { rows: projects } = await queryPostgres<{ budget_by_month: Record<string, number> | null }>(
      `SELECT budget_by_month FROM pf_projects_snapshot`, []
    );

    let totalCredits = 0;
    const allRows = [...listings, ...projects];

    for (const row of allRows) {
      if (!row.budget_by_month) continue;
      
      for (const [month, credits] of Object.entries(row.budget_by_month)) {
        if (!month || month.length < 7) continue;
        const monthStart = `${month.slice(0, 7)}-01`;
        const [year, m] = month.slice(0, 7).split('-');
        const monthEnd = new Date(Date.UTC(Number(year), Number(m), 0)).toISOString().slice(0, 10);
        
        if (startDate && monthEnd < startDate) continue;
        if (endDate && monthStart > endDate) continue;
        
        let overlapStart = monthStart;
        let overlapEnd = monthEnd;
        if (startDate && startDate > overlapStart) overlapStart = startDate;
        if (endDate && endDate < overlapEnd) overlapEnd = endDate;
        
        const overlapDays = (new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / (1000 * 60 * 60 * 24) + 1;
        const totalDays = (new Date(monthEnd).getTime() - new Date(monthStart).getTime()) / (1000 * 60 * 60 * 24) + 1;
        
        totalCredits += Number(credits || 0) * (overlapDays / totalDays);
      }
    }

    if (totalCredits <= 0) return fallbackRate;

    return targetBudgetAed / totalCredits;
  } catch (err) {
    console.error('Failed to compute dynamic PF rate', err);
    return fallbackRate;
  }
}
