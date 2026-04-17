import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';
import { isPostgresConfigured, queryPostgres } from '@/lib/postgres';
import { CLOSED_DEAL_STATUS_IDS } from '@/lib/crmRules.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bqCredentials = process.env.GOOGLE_AUTH_JSON 
  ? JSON.parse(process.env.GOOGLE_AUTH_JSON)
  : undefined;

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  credentials: bqCredentials,
  keyFilename: !bqCredentials ? path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json') : undefined
});

const PF_CREDIT_TO_AED = 1327;

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

  return rows.map((row) => ({
    ...row,
    Reference: row.reference || row.project_id,
    Title: row.title || row.reference || row.project_id,
    District: row.district || 'Other',
    Leads: Number(row.leads_count || 0),
    LeadsByMonth: row.leads_by_month || {},
    Budget: (Number(row.budget || 0) || 0) * PF_CREDIT_TO_AED,
    BudgetByMonth: Object.fromEntries(
      Object.entries(row.budget_by_month || {}).map(([month, value]) => [month, (Number(value || 0) || 0) * PF_CREDIT_TO_AED]),
    ),
    CreatedAt: row.payload?.createdAt || null,
  }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const closedDealStatusSql = CLOSED_DEAL_STATUS_IDS.join(', ');

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

    // Fetch CRM stats from BQ (similar to listings)
    const dateFilter = (startDate && endDate)
      ? `AND pf_created_at BETWEEN '${startDate}' AND '${endDate}'`
      : '';

    const crmQuery = `
      SELECT 
        listing_ref, 
        COUNTIF(crm_status_id = 143) as spam_count,
        COUNTIF(crm_status_id IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)) as qualified_count,
        COUNTIF(crm_status_id IN (70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)) as ql_actual_count,
        COUNTIF(crm_status_id IN (142, 70457474, 70457478, 70457482, 70457486, 70757586)) as meetings_count,
        COUNTIF(crm_status_id IN (${closedDealStatusSql})) as deals_count,
        SUM(IF(crm_status_id IN (${closedDealStatusSql}), potential_value, 0)) as revenue_sum
      FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\`
      WHERE pf_deal_type = 'project' OR listing_ref NOT LIKE '0%'
      ${dateFilter}
      GROUP BY 1
    `;
    const [bqRows] = await bq.query(crmQuery);

    const projectSpamMap: Record<string, number> = {};
    const projectQualifiedMap: Record<string, number> = {};
    const projectQLActualMap: Record<string, number> = {};
    const projectMeetingsMap: Record<string, number> = {};
    const projectDealsMap: Record<string, number> = {};
    const projectRevenueMap: Record<string, number> = {};

    bqRows.forEach((r: any) => {
      if (r.listing_ref) {
        projectSpamMap[r.listing_ref] = Number(r.spam_count || 0);
        projectQualifiedMap[r.listing_ref] = Number(r.qualified_count || 0);
        projectQLActualMap[r.listing_ref] = Number(r.ql_actual_count || 0);
        projectMeetingsMap[r.listing_ref] = Number(r.meetings_count || 0);
        projectDealsMap[r.listing_ref] = Number(r.deals_count || 0);
        projectRevenueMap[r.listing_ref] = Number(r.revenue_sum || 0);
      }
    });

    const formattedRows: any[] = [];

    projects.forEach((p: any) => {
      const budgetByMonth = p.BudgetByMonth || {};
      const leadsByMonth = p.LeadsByMonth || {};
      const months = Array.from(new Set([...Object.keys(budgetByMonth), ...Object.keys(leadsByMonth)]));

      // Match CRM stats by Reference (ProjectId usually)
      const projectSpam = projectSpamMap[p.Reference] || 0;
      const projectQualified = projectQualifiedMap[p.Reference] || 0;
      const projectQLActual = projectQLActualMap[p.Reference] || 0;
      const projectMeetings = projectMeetingsMap[p.Reference] || 0;
      const projectDeals = projectDealsMap[p.Reference] || 0;
      const projectRevenue = projectRevenueMap[p.Reference] || 0;
      const projectLeadsPfTotal = Number(p.Leads || 0);
      const projectLeadsCrmTotal = projectQualified + projectSpam;

      if (months.length > 0) {
        const filteredMonths = months.filter((m) => monthInRange(m));
        if (filteredMonths.length === 0) {
          return;
        }

        const sortedMonths = [...filteredMonths].sort((a,b)=>b.localeCompare(a));
        filteredMonths.forEach(month => {
          const isLatest = month === sortedMonths[0];
          formattedRows.push({
            channel: 'Primary Plus leads',
            level_1: p.District || 'Other',
            level_2: p.Title,
            level_3: month,
            budget: Number(budgetByMonth[month] || 0),
            leads: Number(leadsByMonth[month] || 0),
            leads_pf: Number(leadsByMonth[month] || 0),
            leads_crm: isLatest ? projectLeadsCrmTotal : 0,
            leads_gap: isLatest ? projectLeadsPfTotal - projectLeadsCrmTotal : 0,
            no_answer_spam: isLatest ? projectSpam : 0,
            qualified_leads: isLatest ? projectQualified : 0,
            ql_actual: isLatest ? projectQLActual : 0,
            meetings: isLatest ? projectMeetings : 0,
            deals: isLatest ? projectDeals : 0,
            revenue: isLatest ? projectRevenue : 0,
            company_revenue: isLatest ? projectRevenue : 0,
            date: month,
            sort_order: 1
          });
        });
      } else {
        if (!dateInRange(p.CreatedAt || null)) {
          return;
        }
        formattedRows.push({
          channel: 'Primary Plus leads',
          level_1: p.District || 'Other',
          level_2: p.Title,
          level_3: null,
          budget: Number(p.Budget || 0),
          leads: Number(p.Leads || 0),
          leads_pf: projectLeadsPfTotal,
          leads_crm: projectLeadsCrmTotal,
          leads_gap: projectLeadsPfTotal - projectLeadsCrmTotal,
          no_answer_spam: projectSpam,
          qualified_leads: projectQualified,
          ql_actual: projectQLActual,
          meetings: projectMeetings,
          deals: projectDeals,
          revenue: projectRevenue,
          company_revenue: projectRevenue,
          date: '-',
          sort_order: 1
        });
      }
    });

    // Sort by District, then Project Title, then Month desc
    formattedRows.sort((a, b) => {
      if (a.level_1 !== b.level_1) return a.level_1.localeCompare(b.level_1);
      if (a.level_2 !== b.level_2) return a.level_2.localeCompare(b.level_2);
      if (a.level_3 && b.level_3) return b.level_3.localeCompare(a.level_3);
      return 0;
    });

    return NextResponse.json({ success: true, data: formattedRows });

  } catch (error: any) {
    console.error('API ERROR (PF Projects):', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
