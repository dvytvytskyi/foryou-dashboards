import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { isPostgresConfigured, queryPostgres } from '@/lib/postgres';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    let projects: any[] = [];
    if (isPostgresConfigured()) {
      try {
        projects = await loadProjectsFromPostgres();
      } catch (pgError) {
        console.warn('PF projects PostgreSQL read failed, fallback to JSON:', pgError);
        projects = await loadProjectsFromFile();
      }
    } else {
      projects = await loadProjectsFromFile();
    }

    const formattedRows: any[] = [];

    for (const project of projects) {
      const budgetByMonth = project.BudgetByMonth || {};
      const leadsByMonth = project.LeadsByMonth || {};
      const months = Array.from(new Set([...Object.keys(budgetByMonth), ...Object.keys(leadsByMonth)]));

      if (months.length > 0) {
        const filteredMonths = months.filter((month) => monthInRange(month));
        if (filteredMonths.length === 0) continue;

        for (const month of filteredMonths.sort((a, b) => b.localeCompare(a))) {
          formattedRows.push({
            channel: 'Primary Plus leads',
            level_1: project.District || 'Other',
            level_2: project.Title,
            level_3: month,
            budget: Number(budgetByMonth[month] || 0),
            leads: Number(leadsByMonth[month] || 0),
            leads_pf: Number(leadsByMonth[month] || 0),
            leads_crm: 0,
            leads_gap: 0,
            no_answer_spam: 0,
            qualified_leads: 0,
            ql_actual: 0,
            meetings: 0,
            deals: 0,
            revenue: 0,
            company_revenue: 0,
            date: month,
            cpl: 0,
            sort_order: 1,
          });
        }
      } else {
        formattedRows.push({
          channel: 'Primary Plus leads',
          level_1: project.District || 'Other',
          level_2: project.Title,
          level_3: null,
          budget: Number(project.Budget || 0),
          leads: Number(project.Leads || 0),
          leads_pf: Number(project.Leads || 0),
          leads_crm: 0,
          leads_gap: 0,
          no_answer_spam: 0,
          qualified_leads: 0,
          ql_actual: 0,
          meetings: 0,
          deals: 0,
          revenue: 0,
          company_revenue: 0,
          date: dateInRange(project.CreatedAt || null) ? '-' : null,
          cpl: 0,
          sort_order: 1,
        });
      }
    }

    const rows = formattedRows.filter((row) => row.date !== null);

    rows.sort((a, b) => {
      if (a.level_1 !== b.level_1) return a.level_1.localeCompare(b.level_1);
      if (a.level_2 !== b.level_2) return a.level_2.localeCompare(b.level_2);
      if (a.level_3 && b.level_3) return b.level_3.localeCompare(a.level_3);
      return 0;
    });

    return NextResponse.json({ success: true, data: rows });

  } catch (error: any) {
    console.error('API ERROR (PF Projects):', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
