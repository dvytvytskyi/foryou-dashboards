import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

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

export async function GET() {
  try {
    const jsonPath = path.resolve(process.cwd(), 'pf_listings_report.json');
    const fileContent = await fs.readFile(jsonPath, 'utf8');
    const rawData = JSON.parse(fileContent);

    // Fetch CRM stats from BQ
    const crmQuery = `
      WITH matched AS (
        SELECT 
          listing_ref, 
          pf_deal_type,
          COUNTIF(crm_status_id = 143) as spam_count,
          COUNTIF(crm_status_id IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)) as qualified_count,
          COUNTIF(crm_status_id IN (70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)) as ql_actual_count,
          COUNTIF(crm_status_id IN (142, 70457474, 70457478, 70457482, 70457486, 70757586)) as meetings_count,
          COUNTIF(crm_status_id = 142) as deals_count,
          SUM(IF(crm_status_id = 142, potential_value, 0)) as revenue_sum,
          SUM(potential_value) as potential_revenue_sum,
          COUNT(*) as matched_leads
        FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\`
        GROUP BY 1, 2
      ),
      totals AS (
        SELECT 
          COUNTIF(status_id = 143) as total_spam,
          COUNTIF(status_id IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)) as total_qualified,
          COUNTIF(status_id IN (70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)) as total_ql_actual,
          COUNTIF(status_id IN (142, 70457474, 70457478, 70457482, 70457486, 70757586)) as total_meetings,
          COUNTIF(status_id = 142) as total_deals,
          SUM(IF(status_id = 142, price, 0)) as total_revenue,
          SUM(price) as total_potential_revenue,
          COUNT(*) as total_pf_leads
        FROM \`crypto-world-epta.foryou_analytics.amo_channel_leads_raw\`
        WHERE source_label LIKE '%Property%'
      )
      SELECT * FROM matched CROSS JOIN totals
    `;
    const [bqRows] = await bq.query(crmQuery);
    
    // Maps for merging
    const listingSpamMap: Record<string, number> = {};
    const listingQualifiedMap: Record<string, number> = {};
    const listingQLActualMap: Record<string, number> = {};
    const listingMeetingsMap: Record<string, number> = {};
    const listingDealsMap: Record<string, number> = {};
    const listingRevenueMap: Record<string, number> = {};
    const listingCompRevenueMap: Record<string, number> = {};

    // Lookup for categories
    const refToCategory: Record<string, string> = {};
    rawData.forEach((l: any) => {
      refToCategory[l.Reference] = l.Category;
    });

    let totalCrmSpam = bqRows[0]?.total_spam || 0;
    let totalCrmQualified = bqRows[0]?.total_qualified || 0;
    let totalCrmQLActual = bqRows[0]?.total_ql_actual || 0;
    let totalCrmMeetings = bqRows[0]?.total_meetings || 0;
    let totalCrmDeals = bqRows[0]?.total_deals || 0;
    let totalCrmRevenue = bqRows[0]?.total_revenue || 0;
    let totalCrmPotential = bqRows[0]?.total_potential_revenue || 0;

    let matchedSpamTotal = 0;
    let matchedQualifiedTotal = 0;
    let matchedQLActualTotal = 0;
    let matchedMeetingsTotal = 0;
    let matchedDealsTotal = 0;
    let matchedRevenueTotal = 0;

    bqRows.forEach((r: any) => {
      const spamCount = Number(r.spam_count || 0);
      const qualCount = Number(r.qualified_count || 0);
      const qlActualCount = Number(r.ql_actual_count || 0);
      const meetingsCount = Number(r.meetings_count || 0);
      const dealsCount = Number(r.deals_count || 0);
      const revenue = Number(r.revenue_sum || 0);
      const potential = Number(r.potential_revenue_sum || 0);

      if (r.listing_ref && r.listing_ref !== '0') {
        listingSpamMap[r.listing_ref] = (listingSpamMap[r.listing_ref] || 0) + spamCount;
        listingQualifiedMap[r.listing_ref] = (listingQualifiedMap[r.listing_ref] || 0) + qualCount;
        listingQLActualMap[r.listing_ref] = (listingQLActualMap[r.listing_ref] || 0) + qlActualCount;
        listingMeetingsMap[r.listing_ref] = (listingMeetingsMap[r.listing_ref] || 0) + meetingsCount;
        listingDealsMap[r.listing_ref] = (listingDealsMap[r.listing_ref] || 0) + dealsCount;
        listingRevenueMap[r.listing_ref] = (listingRevenueMap[r.listing_ref] || 0) + (revenue || 0);
        // Estimate company revenue as 2% of deal value
        listingCompRevenueMap[r.listing_ref] = (listingCompRevenueMap[r.listing_ref] || 0) + (revenue * 0.02);
        
        matchedSpamTotal += spamCount;
        matchedQualifiedTotal += qualCount;
        matchedQLActualTotal += qlActualCount;
        matchedMeetingsTotal += meetingsCount;
        matchedDealsTotal += dealsCount;
        matchedRevenueTotal += revenue;
      }
    });

    const unattributedSpam = Math.max(0, totalCrmSpam - matchedSpamTotal);
    const unattributedQualified = Math.max(0, totalCrmQualified - matchedQualifiedTotal);
    const unattributedQLActual = Math.max(0, totalCrmQLActual - matchedQLActualTotal);
    const unattributedMeetings = Math.max(0, totalCrmMeetings - matchedMeetingsTotal);
    const unattributedDeals = Math.max(0, totalCrmDeals - matchedDealsTotal);
    const unattributedRevenue = Math.max(0, totalCrmRevenue - matchedRevenueTotal);
    const unattributedCompRevenue = unattributedRevenue * 0.02;

    const formattedRows: any[] = [];

    const categoryOrder: Record<string, number> = {
      'Sell': 1,
      'Rent': 2,
      'Commercial Sell': 3,
      'Commercial Rent': 4
    };

    rawData.forEach((l: any) => {
      const listingLabel = `${l.Reference} | ${l.Title || 'No Title'}`;
      const sort_order = categoryOrder[l.Category] || 99;
      const listingSpam = listingSpamMap[l.Reference] || 0;
      const listingQualified = listingQualifiedMap[l.Reference] || 0;
      const listingQLActual = listingQLActualMap[l.Reference] || 0;
      const listingMeetings = listingMeetingsMap[l.Reference] || 0;
      const listingDeals = listingDealsMap[l.Reference] || 0;
      const listingRevenue = listingRevenueMap[l.Reference] || 0;
      const listingCompRevenue = listingCompRevenueMap[l.Reference] || 0;

      const budgetByMonth = l.BudgetByMonth || {};
      const months = Object.keys(budgetByMonth);

      if (months.length > 0) {
        const sortedMonths = [...months].sort((a,b)=>b.localeCompare(a));
        months.forEach(month => {
          const isLatest = month === sortedMonths[0];
          formattedRows.push({
            channel: 'Property Finder',
            level_1: l.Category,
            level_2: listingLabel,
            level_3: month,
            budget: Number(budgetByMonth[month] || 0),
            leads: isLatest ? Number(l.Leads || 0) : 0,
            no_answer_spam: isLatest ? listingSpam : 0,
            qualified_leads: isLatest ? listingQualified : 0,
            ql_actual: isLatest ? listingQLActual : 0,
            meetings: isLatest ? listingMeetings : 0,
            deals: isLatest ? listingDeals : 0,
            revenue: isLatest ? listingRevenue : 0,
            company_revenue: isLatest ? listingCompRevenue : 0,
            date: month,
            cpl: 0,
            sort_order: sort_order
          });
        });
      } else {
        formattedRows.push({
          channel: 'Property Finder',
          level_1: l.Category,
          level_2: listingLabel,
          level_3: null,
          budget: Number(l.Budget || 0),
          leads: Number(l.Leads || 0),
          no_answer_spam: listingSpam,
          qualified_leads: listingQualified,
          ql_actual: listingQLActual,
          meetings: listingMeetings,
          deals: listingDeals,
          revenue: listingRevenue,
          company_revenue: listingCompRevenue,
          date: l.CreatedAt ? l.CreatedAt.slice(0, 10) : '-',
          cpl: 0,
          sort_order: sort_order
        });
      }
    });

    // Додаємо ліди, які не прив'язані до конкретних лістингів
    if (unattributedSpam > 0 || unattributedQualified > 0 || unattributedQLActual > 0 || unattributedMeetings > 0 || unattributedDeals > 0 || unattributedRevenue > 0) {
      formattedRows.push({
        channel: 'Property Finder',
        level_1: 'Sell', 
        level_2: 'Unattributed CRM Leads (No Ref Match)',
        level_3: null,
        budget: 0,
        leads: unattributedSpam + unattributedQualified, 
        no_answer_spam: unattributedSpam,
        qualified_leads: unattributedQualified,
        ql_actual: unattributedQLActual,
        meetings: unattributedMeetings,
        deals: unattributedDeals,
        revenue: unattributedRevenue,
        company_revenue: unattributedCompRevenue,
        date: '-',
        cpl: 0,
        sort_order: 1
      });
    }

    // Sorting by category, then by level_2 title, then by month (level_3) desc
    formattedRows.sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      if (a.level_2 !== b.level_2) return a.level_2.localeCompare(b.level_2);
      if (a.level_3 && b.level_3) return b.level_3.localeCompare(a.level_3);
      return 0;
    });

    // DashboardPage automatically aggregates levels.
    // So channel level will be sum of all level_1, which will be sum of all level_2.

    return NextResponse.json({ success: true, data: formattedRows });

  } catch (error: any) {
    console.error('API ERROR (PF Listings):', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
