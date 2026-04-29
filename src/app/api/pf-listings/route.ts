import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { isPostgresConfigured, queryPostgres } from '@/lib/postgres';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  leads_by_month: Record<string, number> | null;
  source_updated_at: Date | string | null;
  payload: Record<string, any> | null;
};

type MatchStatsRow = {
  category: string;
  pf_leads: number | string;
  matched_amo_leads: number | string;
  spam_count: number | string;
  qualified_count: number | string;
  ql_actual_count: number | string;
  meetings_count: number | string;
  deals_count: number | string;
  revenue_sum: number | string;
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
              budget, budget_by_month, leads_count, leads_by_month, source_updated_at, payload
      FROM pf_listings_snapshot
      WHERE ($1::text IS NULL OR group_name = $1)
    `,
    [targetGroup],
  );

  return rows.map((row: ListingSnapshotRow) => ({
    Reference: row.reference || row.listing_id,
    group: row.group_name || 'Our',
    Category:
      row.category ||
      (row.offering_type === 'sale' ? 'Sell' : row.offering_type === 'rent' ? 'Rent' : 'Other'),
    Title: row.title || row.reference || row.listing_id,
    status: row.status || 'Active',
    Budget: Number(row.budget || 0) || 0,
    BudgetByMonth: row.budget_by_month || {},
    LeadsPF: Number(row.leads_count || 0) || 0,
    LeadsByMonth: row.leads_by_month || {},
    CreatedAt:
      (row.payload?.createdAt ??
        (typeof row.source_updated_at === 'string'
          ? row.source_updated_at
          : row.source_updated_at instanceof Date
            ? row.source_updated_at.toISOString()
            : null)),
  }));
}

async function loadMatchStatsFromPostgres(startDate: string | null, endDate: string | null) {
  let { rows } = await queryPostgres<MatchStatsRow>(
    `
      SELECT DISTINCT ON (category)
        category,
        pf_leads,
        matched_amo_leads,
        spam_count,
        qualified_count,
        ql_actual_count,
        meetings_count,
        deals_count,
        revenue_sum
      FROM pf_amo_match_stats
      WHERE (
        ($1::date IS NULL OR period_start <= $1::date)
        AND ($2::date IS NULL OR period_end >= $2::date)
      )
      ORDER BY category, updated_at DESC
    `,
    [startDate, endDate],
  );

  if (!rows.length) {
    const fallback = await queryPostgres<MatchStatsRow>(
      `
        SELECT DISTINCT ON (category)
          category,
          pf_leads,
          matched_amo_leads,
          spam_count,
          qualified_count,
          ql_actual_count,
          meetings_count,
          deals_count,
          revenue_sum
        FROM pf_amo_match_stats
        ORDER BY category, updated_at DESC
      `,
      [],
    );
    rows = fallback.rows;
  }

  const byCategory: Record<string, {
    matchRate: number;
    spamRate: number;
    qualifiedRate: number;
    qlActualRate: number;
    meetingsRate: number;
    dealsRate: number;
    revenuePerMatched: number;
  }> = {};

  for (const row of rows) {
    const category =
      row.category === 'Sell' || row.category === 'Rent' ||
      row.category === 'Commercial Sell' || row.category === 'Commercial Rent'
        ? row.category
        : 'Other';
    const pfLeads = Number(row.pf_leads || 0);
    const matched = Number(row.matched_amo_leads || 0);
    const spam = Number(row.spam_count || 0);
    const qualified = Number(row.qualified_count || 0);
    const qlActual = Number(row.ql_actual_count || 0);
    const meetings = Number(row.meetings_count || 0);
    const deals = Number(row.deals_count || 0);
    const revenue = Number(row.revenue_sum || 0);

    byCategory[category] = {
      matchRate: pfLeads > 0 ? matched / pfLeads : 0,
      spamRate: matched > 0 ? spam / matched : 0,
      qualifiedRate: matched > 0 ? qualified / matched : 0,
      qlActualRate: matched > 0 ? qlActual / matched : 0,
      meetingsRate: matched > 0 ? meetings / matched : 0,
      dealsRate: matched > 0 ? deals / matched : 0,
      revenuePerMatched: matched > 0 ? revenue / matched : 0,
    };
  }

  return byCategory;
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

    const formattedRows: any[] = [];

    let categoryStats: Record<string, any> = {};
    if ((targetGroup === 'Our' || targetGroup === 'Partner') && isPostgresConfigured()) {
      try {
        categoryStats = await loadMatchStatsFromPostgres(startDate, endDate);
      } catch (statsError) {
        console.warn('PF match stats read failed, fallback to zero CRM metrics:', statsError);
      }
    }

    const filteredData = targetGroup
      ? rawData.filter((l: any) => l.group === targetGroup)
      : rawData;

    filteredData.forEach((l: any) => {
      const listingLeadsPf = Number(l.LeadsPF || 0);
      const normalizedCategory =
        l.Category === 'Sell' || l.Category === 'Rent' ||
        l.Category === 'Commercial Sell' || l.Category === 'Commercial Rent'
          ? l.Category
          : 'Other';
      const stats = categoryStats[normalizedCategory] || null;

      const estimatedMatched = stats ? listingLeadsPf * stats.matchRate : 0;
      const listingSpam = stats ? estimatedMatched * stats.spamRate : 0;
      const listingQualified = stats ? estimatedMatched * stats.qualifiedRate : 0;
      const listingQLActual = stats ? estimatedMatched * stats.qlActualRate : 0;
      const listingMeetings = stats ? estimatedMatched * stats.meetingsRate : 0;
      const listingDeals = stats ? estimatedMatched * stats.dealsRate : 0;
      const listingRevenue = stats ? estimatedMatched * stats.revenuePerMatched : 0;
      const listingCompRevenue = 0;
      
      const listingLabel = l.Title && l.Title.length > 30 ? `${l.Title.slice(0, 30)}...` : (l.Title || l.Reference);
      const sort_order = l.Category === 'Sell' ? 1 : l.Category === 'Rent' ? 2 : l.Category === 'Commercial Sell' ? 3 : l.Category === 'Commercial Rent' ? 4 : 5;

      const budgetByMonth = l.BudgetByMonth || {};
      const leadsByMonth = l.LeadsByMonth || {};
      const months = Object.keys(budgetByMonth);

      if (months.length > 0) {
        const filteredMonths = months.filter((m) => monthInRange(m));
        if (filteredMonths.length === 0) {
          return;
        }

        filteredMonths.forEach(month => {
          const monthLeads = Number(leadsByMonth[month] || 0);
          formattedRows.push({
            channel: 'Property Finder',
            level_1: l.Category,
            level_2: listingLabel,
            level_3: month,
            budget: Number(budgetByMonth[month] || 0),
            leads: monthLeads,
            no_answer_spam: listingLeadsPf > 0 ? (listingSpam * monthLeads) / listingLeadsPf : 0,
            qualified_leads: listingLeadsPf > 0 ? (listingQualified * monthLeads) / listingLeadsPf : 0,
            ql_actual: listingLeadsPf > 0 ? (listingQLActual * monthLeads) / listingLeadsPf : 0,
            meetings: listingLeadsPf > 0 ? (listingMeetings * monthLeads) / listingLeadsPf : 0,
            deals: listingLeadsPf > 0 ? (listingDeals * monthLeads) / listingLeadsPf : 0,
            revenue: listingLeadsPf > 0 ? (listingRevenue * monthLeads) / listingLeadsPf : 0,
            company_revenue: listingLeadsPf > 0 ? (listingCompRevenue * monthLeads) / listingLeadsPf : 0,
            date: month,
            cpl: 0,
            sort_order: sort_order,
            status: l.status || 'Active'
          });
        });
      } else {
        const filteredLeadMonths = Object.entries(leadsByMonth).filter(([month]) => monthInRange(month));
        const rangedLeads = filteredLeadMonths.reduce((sum, [, count]) => sum + Number(count || 0), 0);
        if (startDate || endDate) {
          if (rangedLeads === 0) return;
        } else if (!dateInRange(l.CreatedAt || null)) {
          return;
        }
        formattedRows.push({
          channel: 'Property Finder',
          level_1: l.Category,
          level_2: listingLabel,
          level_3: null,
          budget: Number(l.Budget || 0),
          leads: rangedLeads || listingLeadsPf,
          no_answer_spam: listingLeadsPf > 0 ? (listingSpam * (rangedLeads || listingLeadsPf)) / listingLeadsPf : 0,
          qualified_leads: listingLeadsPf > 0 ? (listingQualified * (rangedLeads || listingLeadsPf)) / listingLeadsPf : 0,
          ql_actual: listingLeadsPf > 0 ? (listingQLActual * (rangedLeads || listingLeadsPf)) / listingLeadsPf : 0,
          meetings: listingLeadsPf > 0 ? (listingMeetings * (rangedLeads || listingLeadsPf)) / listingLeadsPf : 0,
          deals: listingLeadsPf > 0 ? (listingDeals * (rangedLeads || listingLeadsPf)) / listingLeadsPf : 0,
          revenue: listingLeadsPf > 0 ? (listingRevenue * (rangedLeads || listingLeadsPf)) / listingLeadsPf : 0,
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
