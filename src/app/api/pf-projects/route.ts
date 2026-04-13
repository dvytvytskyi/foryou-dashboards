import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

export async function GET() {
  try {
    const jsonPath = path.resolve(process.cwd(), 'pf_projects_report.json');
    const fileContent = await fs.readFile(jsonPath, 'utf8');
    const projects = JSON.parse(fileContent);

    // Fetch CRM stats from BQ (similar to listings)
    const crmQuery = `
      SELECT 
        listing_ref, 
        COUNTIF(crm_status_id = 143) as spam_count,
        COUNTIF(crm_status_id IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)) as qualified_count,
        COUNTIF(crm_status_id IN (70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)) as ql_actual_count,
        COUNTIF(crm_status_id IN (142, 70457474, 70457478, 70457482, 70457486, 70757586)) as meetings_count,
        COUNTIF(crm_status_id = 142) as deals_count,
        SUM(IF(crm_status_id = 142, potential_value, 0)) as revenue_sum
      FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\`
      WHERE pf_deal_type = 'project' OR listing_ref NOT LIKE '0%'
      GROUP BY 1
    `;
    const [bqRows] = await bq.query(crmQuery);

    const projectSpamMap = {};
    const projectQualifiedMap = {};
    const projectQLActualMap = {};
    const projectMeetingsMap = {};
    const projectDealsMap = {};
    const projectRevenueMap = {};

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

      if (months.length > 0) {
        const sortedMonths = [...months].sort((a,b)=>b.localeCompare(a));
        months.forEach(month => {
          const isLatest = month === sortedMonths[0];
          formattedRows.push({
            channel: 'Primary Plus leads',
            level_1: p.District || 'Other',
            level_2: p.Title,
            level_3: month,
            budget: Number(budgetByMonth[month] || 0),
            leads: Number(leadsByMonth[month] || 0),
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
        formattedRows.push({
          channel: 'Primary Plus leads',
          level_1: p.District || 'Other',
          level_2: p.Title,
          level_3: null,
          budget: Number(p.Budget || 0),
          leads: Number(p.Leads || 0),
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
