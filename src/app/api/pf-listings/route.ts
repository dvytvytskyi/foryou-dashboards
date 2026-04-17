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

type ListingSnapshotRow = {
  listing_id: string;
  reference: string | null;
  group_name: string | null;
  category: string | null;
  offering_type: string | null;
  title: string | null;
  status: string | null;
  budget: number | string | null;
  budget_by_month: Record<string, number> | null;
  leads_count: number | string | null;
  source_updated_at: Date | string | null;
  payload: Record<string, any> | null;
};

async function loadListingsFromFile() {
  const jsonPath = path.resolve(process.cwd(), 'pf_listings_report.json');
  const fileContent = await fs.readFile(jsonPath, 'utf8');
  return JSON.parse(fileContent);
}

async function loadListingsFromPostgres(targetGroup: string | null) {
  const { rows } = await queryPostgres<ListingSnapshotRow>(
    `
      SELECT listing_id, reference, group_name, category, offering_type, title, status,
             budget, budget_by_month, leads_count, source_updated_at, payload
      FROM pf_listings_snapshot
      WHERE ($1::text IS NULL OR group_name = $1)
    `,
    [targetGroup],
  );

  const toBudgetByMonthAed = (budgetByMonth: Record<string, number>) => {
    const converted: Record<string, number> = {};
    for (const [month, value] of Object.entries(budgetByMonth || {})) {
      converted[month] = (Number(value || 0) || 0) * PF_CREDIT_TO_AED;
    }
    return converted;
  };

  return rows.map((row) => ({
    Reference: row.reference || row.listing_id,
    group: row.group_name || 'Our',
    Category:
      row.category ||
      (row.offering_type === 'sale' ? 'Sell' : row.offering_type === 'rent' ? 'Rent' : 'Other'),
    Title: row.title || row.reference || row.listing_id,
    status: row.status || 'Active',
    Budget: (Number(row.budget || 0) || 0) * PF_CREDIT_TO_AED,
    BudgetByMonth: toBudgetByMonthAed(row.budget_by_month || {}),
    LeadsPF: Number(row.leads_count || 0) || 0,
    CreatedAt:
      typeof row.source_updated_at === 'string'
        ? row.source_updated_at
        : row.source_updated_at instanceof Date
          ? row.source_updated_at.toISOString()
          : (row.payload?.createdAt ?? null),
  }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetGroup = searchParams.get('group'); // 'Our' or 'Partner'
    let rawData: any[] = [];

    if (isPostgresConfigured()) {
      try {
        rawData = await loadListingsFromPostgres(targetGroup);
      } catch (pgError) {
        console.warn('PF listings PostgreSQL read failed, fallback to JSON:', pgError);
        rawData = await loadListingsFromFile();
      }
    } else {
      rawData = await loadListingsFromFile();
    }

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

    const closedDealStatusSql = CLOSED_DEAL_STATUS_IDS.join(', ');

    // Fetch CRM stats from BQ with date filtering
    const dateFilter = (startDate && endDate) 
      ? `AND created_at BETWEEN '${startDate}' AND '${endDate}'`
      : '';
    const pfMasterDateFilter = (startDate && endDate)
      ? `AND pf_created_at BETWEEN '${startDate}' AND '${endDate}'`
      : '';

    const crmQuery = `
      WITH matched AS (
        SELECT 
          listing_ref, 
          pf_deal_type,
          COUNTIF(crm_status_id = 143) as spam_count,
          COUNTIF(crm_status_id IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)) as qualified_count,
          COUNTIF(crm_status_id IN (70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)) as ql_actual_count,
          COUNTIF(crm_status_id IN (142, 70457474, 70457478, 70457482, 70457486, 70757586)) as meetings_count,
          COUNTIF(crm_status_id IN (${closedDealStatusSql})) as deals_count,
          SUM(IF(crm_status_id IN (${closedDealStatusSql}), potential_value, 0)) as revenue_sum,
          SUM(potential_value) as potential_revenue_sum,
          COUNT(*) as matched_leads
        FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\`
        WHERE 1=1 ${pfMasterDateFilter}
        GROUP BY 1, 2
      ),
      totals AS (
        SELECT 
          COUNTIF(status_id = 143) as total_spam,
          COUNTIF(status_id IN (142, 70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)) as total_qualified,
          COUNTIF(status_id IN (70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586)) as total_ql_actual,
          COUNTIF(status_id IN (142, 70457474, 70457478, 70457482, 70457486, 70757586)) as total_meetings,
          COUNTIF(status_id IN (${closedDealStatusSql})) as total_deals,
          SUM(IF(status_id IN (${closedDealStatusSql}), price, 0)) as total_revenue,
          SUM(price) as total_potential_revenue,
          COUNT(*) as total_pf_leads
        FROM \`crypto-world-epta.foryou_analytics.amo_channel_leads_raw\`
        WHERE source_label LIKE '%Property%' ${dateFilter}
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

    const normalizeRef = (ref: string) => {
      if (!ref) return '';
      const match = ref.match(/\d+$/);
      return match ? match[0].replace(/^0+/, '') : ref;
    };

    const crmStats: any = {};
    bqRows.forEach((r: any) => {
      if (r.listing_ref) {
        const type = r.pf_deal_type === 'Sale' ? 'Sell' : r.pf_deal_type;
        const key = `${normalizeRef(r.listing_ref)}_${type}`;
        crmStats[key] = r;
      }
    });

    const filteredData = targetGroup
      ? rawData.filter((l: any) => l.group === targetGroup)
      : rawData;

    filteredData.forEach((l: any) => {
      const normRef = normalizeRef(l.Reference);
      const stats = crmStats[`${normRef}_${l.Category}`] || {};
      const listingLeadsPf = Number(l.LeadsPF || 0);
      const listingLeads = Number(stats.matched_leads || 0);
      const listingSpam = Number(stats.spam_count || 0);
      const listingQualified = Number(stats.qualified_count || 0);
      const listingQLActual = Number(stats.ql_actual_count || 0);
      const listingMeetings = Number(stats.meetings_count || 0);
      const listingDeals = Number(stats.deals_count || 0);
      const listingRevenue = Number(stats.revenue_sum || 0);
      const listingCompRevenue = Number(l.CompanyRevenue || 0);
      
      const listingLabel = l.Title && l.Title.length > 30 ? `${l.Title.slice(0, 30)}...` : (l.Title || l.Reference);
      const sort_order = l.Category === 'Sell' ? 1 : l.Category === 'Rent' ? 2 : 3;

      const budgetByMonth = l.BudgetByMonth || {};
      const months = Object.keys(budgetByMonth);

      if (months.length > 0) {
        const filteredMonths = months.filter((m) => monthInRange(m));
        if (filteredMonths.length === 0) {
          return;
        }

        const sortedMonths = [...filteredMonths].sort((a,b)=>b.localeCompare(a));
        filteredMonths.forEach(month => {
          const isLatest = month === sortedMonths[0]; // ONLY LATEST MONTH GETS LEADS
          formattedRows.push({
            channel: 'Property Finder',
            level_1: l.Category,
            level_2: listingLabel,
            level_3: month,
            budget: Number(budgetByMonth[month] || 0),
            leads: isLatest ? listingLeads : 0,
            leads_pf: isLatest ? listingLeadsPf : 0,
            leads_crm: isLatest ? listingLeads : 0,
            leads_gap: isLatest ? listingLeadsPf - listingLeads : 0,
            no_answer_spam: isLatest ? listingSpam : 0,
            qualified_leads: isLatest ? listingQualified : 0,
            ql_actual: isLatest ? listingQLActual : 0,
            meetings: isLatest ? listingMeetings : 0,
            deals: isLatest ? listingDeals : 0,
            revenue: isLatest ? listingRevenue : 0,
            company_revenue: isLatest ? listingCompRevenue : 0,
            date: month,
            cpl: 0,
            sort_order: sort_order,
            status: l.status || 'Active'
          });
        });
      } else {
        if (!dateInRange(l.CreatedAt || null)) {
          return;
        }
        formattedRows.push({
          channel: 'Property Finder',
          level_1: l.Category,
          level_2: listingLabel,
          level_3: null,
          budget: Number(l.Budget || 0),
          leads: listingLeads,
          leads_pf: listingLeadsPf,
          leads_crm: listingLeads,
          leads_gap: listingLeadsPf - listingLeads,
          no_answer_spam: listingSpam,
          qualified_leads: listingQualified,
          ql_actual: listingQLActual,
          meetings: listingMeetings,
          deals: listingDeals,
          revenue: listingRevenue,
          company_revenue: listingCompRevenue,
          date: l.CreatedAt ? l.CreatedAt.slice(0, 10) : '-',
          cpl: 0,
          sort_order: sort_order,
          status: l.status || 'Active'
        });
      }
    });

    /*
    // Add group-specific unattributed leads
    const targetBucket = (targetGroup === 'Partner' || targetGroup === 'Our') ? targetGroup : 'Our';
    const groupUnattributed = unattributedByGroup[targetBucket];

    if (groupUnattributed && groupUnattributed.leads > 0) {
      formattedRows.push({
        channel: 'Property Finder',
        level_1: 'TOTAL',
        level_2: 'Unattributed CRM Leads (No Ref Match)',
        level_3: null,
        budget: 0,
        leads: groupUnattributed.leads,
        no_answer_spam: groupUnattributed.spam,
        qualified_leads: groupUnattributed.qualified,
        ql_actual: groupUnattributed.ql_actual,
        meetings: groupUnattributed.meetings,
        deals: groupUnattributed.deals,
        revenue: groupUnattributed.revenue,
        company_revenue: 0,
        date: '-',
        cpl: 0,
        sort_order: 99
      });
    }
    */

    // Sorting by status (Active first, Archive last), then by category, then by title
    formattedRows.sort((a, b) => {
      // Archive goes last
      if (a.status === 'Archive' && b.status !== 'Archive') return 1;
      if (a.status !== 'Archive' && b.status === 'Archive') return -1;
      
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
