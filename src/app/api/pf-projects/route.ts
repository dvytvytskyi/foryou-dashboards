import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { isPostgresConfigured, queryPostgres } from '@/lib/postgres';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const CREDIT_TO_AED_RATE = 1.9;

function monthKeyOverlapsRange(monthKey: string, startDate: string | null, endDate: string | null) {
  if (!monthKey || monthKey.length < 7) return true;
  if (!startDate || !endDate) return true;

  const normalizedMonth = monthKey.slice(0, 7);
  const monthStart = `${normalizedMonth}-01`;

  const [yearStr, monthStr] = normalizedMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return true;

  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

  // Prevent mixing custom day ranges with monthly buckets:
  // a month bucket is used only when the whole month is inside selected range.
  if (monthStart < startDate) return false;
  if (monthEnd > endDate) return false;
  return true;
}

type AmoProjectMatch = {
  crm_leads: number;
  spam: number;
  qualified_leads: number;
  ql_actual: number;
  meetings: number;
  deals: number;
  crm_leads_by_month: Record<string, number>;
  spam_by_month: Record<string, number>;
  qualified_leads_by_month: Record<string, number>;
  ql_actual_by_month: Record<string, number>;
  meetings_by_month: Record<string, number>;
  deals_by_month: Record<string, number>;
};

async function loadAmoProjectMatch(): Promise<Record<string, AmoProjectMatch>> {
  // 1. Try PostgreSQL first (preferred, always up-to-date)
  if (isPostgresConfigured()) {
    try {
      const { rows } = await queryPostgres<{
        project_id: string;
        crm_leads: number;
        spam: number;
        qualified_leads: number;
        ql_actual: number;
        meetings: number;
        deals: number;
        crm_leads_by_month: Record<string, number>;
        spam_by_month: Record<string, number>;
        qualified_leads_by_month: Record<string, number>;
        ql_actual_by_month: Record<string, number>;
        meetings_by_month: Record<string, number>;
        deals_by_month: Record<string, number>;
      }>(`SELECT * FROM pf_amo_project_match_stats`);

      if (rows.length > 0) {
        const result: Record<string, AmoProjectMatch> = {};
        for (const row of rows) {
          result[row.project_id] = {
            crm_leads: Number(row.crm_leads || 0),
            spam: Number(row.spam || 0),
            qualified_leads: Number(row.qualified_leads || 0),
            ql_actual: Number(row.ql_actual || 0),
            meetings: Number(row.meetings || 0),
            deals: Number(row.deals || 0),
            crm_leads_by_month: (row.crm_leads_by_month as Record<string, number>) || {},
            spam_by_month: (row.spam_by_month as Record<string, number>) || {},
            qualified_leads_by_month: (row.qualified_leads_by_month as Record<string, number>) || {},
            ql_actual_by_month: (row.ql_actual_by_month as Record<string, number>) || {},
            meetings_by_month: (row.meetings_by_month as Record<string, number>) || {},
            deals_by_month: (row.deals_by_month as Record<string, number>) || {},
          };
        }
        return result;
      }
    } catch {
      // fall through to JSON file
    }
  }

  // 2. Fallback: JSON file cache
  try {
    const matchPath = path.resolve(process.cwd(), 'data/cache/pf_amo_project_match.json');
    const raw = await fs.readFile(matchPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.byProject || {};
  } catch {
    return {};
  }
}

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
    const amoMatch = await loadAmoProjectMatch();

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
      return monthKeyOverlapsRange(monthKey, startDate, endDate);
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
      const projectId = String(project.ProjectId || project.Reference || '');
      const amoData = projectId ? (amoMatch[projectId] || null) : null;
      const amoCrmLeadsByMonth = amoData?.crm_leads_by_month || {};
      const amoSpamByMonth = amoData?.spam_by_month || {};
      const amoQualifiedByMonth = amoData?.qualified_leads_by_month || {};
      const amoQlActualByMonth = amoData?.ql_actual_by_month || {};
      const amoMeetingsByMonth = amoData?.meetings_by_month || {};
      const amoDealsByMonth = amoData?.deals_by_month || {};
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
          const crm_leads = Number(amoCrmLeadsByMonth[month] || 0);
          const spam = Number(amoSpamByMonth[month] || 0);
          const qualified_leads = Number(amoQualifiedByMonth[month] || 0);
          const ql_actual = Number(amoQlActualByMonth[month] || 0);
          const meetings = Number(amoMeetingsByMonth[month] || 0);
          const deals = Number(amoDealsByMonth[month] || 0);

          formattedRows.push({
            channel: 'Primary Plus leads',
            level_1: districtLabel,
            level_2: projectLabel,
            level_3: month,
            budget: budgetAed,
            leads,
            crm_leads,
            no_answer_spam: spam,
            rate_answer: crm_leads > 0 ? (crm_leads - spam) / crm_leads : 0,
            qualified_leads,
            cost_per_qualified_leads: qualified_leads > 0 ? budgetAed / qualified_leads : 0,
            ql_actual,
            cpql_actual: ql_actual > 0 ? budgetAed / ql_actual : 0,
            meetings,
            cp_meetings: meetings > 0 ? budgetAed / meetings : 0,
            deals,
            cost_per_deal: deals > 0 ? budgetAed / deals : 0,
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
      const crm_leads = amoData?.crm_leads || 0;
      const spam = amoData?.spam || 0;
      const qualified_leads = amoData?.qualified_leads || 0;
      const ql_actual = amoData?.ql_actual || 0;
      const meetings = amoData?.meetings || 0;
      const deals = amoData?.deals || 0;

      formattedRows.push({
        channel: 'Primary Plus leads',
        level_1: districtLabel,
        level_2: projectLabel,
        level_3: null,
        budget: totalBudgetAed,
        leads: totalLeads,
        crm_leads,
        no_answer_spam: spam,
        rate_answer: crm_leads > 0 ? (crm_leads - spam) / crm_leads : 0,
        qualified_leads,
        cost_per_qualified_leads: qualified_leads > 0 ? totalBudgetAed / qualified_leads : 0,
        ql_actual,
        cpql_actual: ql_actual > 0 ? totalBudgetAed / ql_actual : 0,
        meetings,
        cp_meetings: meetings > 0 ? totalBudgetAed / meetings : 0,
        deals,
        cost_per_deal: deals > 0 ? totalBudgetAed / deals : 0,
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
