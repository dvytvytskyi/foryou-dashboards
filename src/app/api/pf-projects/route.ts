import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { isPostgresConfigured, queryPostgres } from '@/lib/postgres';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const CREDIT_TO_AED_RATE = 1.3;

type ProjectSnapshotRow = {
  project_id: string;
  reference: string | null;
  title: string | null;
  district: string | null;
  leads_count: number | string | null;
  leads_by_month: Record<string, number> | null;
  budget: number | string | null;
  budget_by_month: Record<string, number> | null;
  payload: Record<string, any> | null;
};

async function loadProjectsFromFile() {
  const jsonPath = path.resolve(process.cwd(), 'pf_projects_report.json');
  const fileContent = await fs.readFile(jsonPath, 'utf8');
  return JSON.parse(fileContent);
}

async function loadProjectsFromPostgres() {
  const { rows } = await queryPostgres<ProjectSnapshotRow>(
    `
      SELECT project_id, reference, title, district, leads_count,
             leads_by_month, budget, budget_by_month, payload
      FROM pf_projects_snapshot
    `,
  );

  return rows.map((row: ProjectSnapshotRow) => ({
    Reference: row.reference || row.project_id,
    Title: row.title || row.reference || row.project_id,
    District: row.district || 'Other',
    Leads: Number(row.leads_count || 0) || 0,
    LeadsByMonth: row.leads_by_month || {},
    Budget: Number(row.budget || 0) || 0,
    BudgetByMonth: row.budget_by_month || {},
    CreatedAt:
      row.payload?.sampleLead?.createdAt ||
      row.payload?.projectDetail?.createdAt ||
      row.payload?.createdAt ||
      null,
  }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let rawData: any[] = [];

    if (isPostgresConfigured()) {
      try {
        rawData = await loadProjectsFromPostgres();
      } catch (pgError) {
        console.warn('PF projects PostgreSQL read failed, fallback to JSON:', pgError);
        rawData = await loadProjectsFromFile();
      }
    } else {
      rawData = await loadProjectsFromFile();
    }

    const monthInRange = (monthKey: string) => {
      if (!startDate || !endDate) return true;
      if (!monthKey || monthKey.length < 7) return true;
      const monthStart = `${monthKey.slice(0, 7)}-01`;
      return monthStart >= startDate && monthStart <= endDate;
    };

    const dateInRange = (dateString?: string | null) => {
      if (!startDate || !endDate) return true;
      if (!dateString) return true;
      const normalized = dateString.slice(0, 10);
      return normalized >= startDate && normalized <= endDate;
    };

    const formattedRows: any[] = [];

    rawData.forEach((project: any) => {
      const districtLabel = project.District || 'Other';
      const projectLabel = project.Title || project.Reference || project.ProjectId || 'Unknown Project';
      const leadsByMonth = project.LeadsByMonth || {};
      const budgetByMonth = project.BudgetByMonth || {};
      const monthKeys = Array.from(new Set([
        ...Object.keys(leadsByMonth),
        ...Object.keys(budgetByMonth),
      ]));

      if (monthKeys.length > 0) {
        const filteredMonths = monthKeys.filter((m) => monthInRange(m));
        if (filteredMonths.length === 0) return;

        filteredMonths.forEach((month) => {
          const leads = Number(leadsByMonth[month] || 0);
          const budgetCredits = Number(budgetByMonth[month] || 0);
          const budgetAed = budgetCredits * CREDIT_TO_AED_RATE;

          formattedRows.push({
            channel: 'Primary Plus leads',
            level_1: districtLabel,
            level_2: projectLabel,
            level_3: month,
            budget: budgetAed,
            leads,
            no_answer_spam: 0,
            rate_answer: 0,
            qualified_leads: 0,
            cost_per_qualified_leads: 0,
            ql_actual: 0,
            cpql_actual: 0,
            meetings: 0,
            cp_meetings: 0,
            deals: 0,
            cost_per_deal: 0,
            revenue: 0,
            date: month,
            cpl: leads > 0 ? budgetAed / leads : 0,
            sort_order: 1,
            status: 'Active',
          });
        });
        return;
      }

      if (!dateInRange(project.CreatedAt || null)) return;

      const totalLeads = Number(project.Leads || 0);
      const totalBudgetCredits = Number(project.Budget || 0);
      const totalBudgetAed = totalBudgetCredits * CREDIT_TO_AED_RATE;

      formattedRows.push({
        channel: 'Primary Plus leads',
        level_1: districtLabel,
        level_2: projectLabel,
        level_3: null,
        budget: totalBudgetAed,
        leads: totalLeads,
        no_answer_spam: 0,
        rate_answer: 0,
        qualified_leads: 0,
        cost_per_qualified_leads: 0,
        ql_actual: 0,
        cpql_actual: 0,
        meetings: 0,
        cp_meetings: 0,
        deals: 0,
        cost_per_deal: 0,
        revenue: 0,
        date: project.CreatedAt ? String(project.CreatedAt).slice(0, 10) : '-',
        cpl: totalLeads > 0 ? totalBudgetAed / totalLeads : 0,
        sort_order: 1,
        status: 'Active',
      });
    });

    formattedRows.sort((a, b) => {
      if (a.level_1 !== b.level_1) return String(a.level_1).localeCompare(String(b.level_1));
      if (a.level_2 !== b.level_2) return String(a.level_2).localeCompare(String(b.level_2));
      if (a.level_3 && b.level_3) return String(b.level_3).localeCompare(String(a.level_3));
      return 0;
    });

    return NextResponse.json({
      success: true,
      data: formattedRows,
      meta: {
        budgetUnit: 'AED',
        creditToAedRate: CREDIT_TO_AED_RATE,
      },
    });
  } catch (error: any) {
    console.error('API ERROR (PF Projects):', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
