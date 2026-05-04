import { NextResponse } from 'next/server';
import { isPostgresConfigured, queryPostgres } from '@/lib/postgres';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CREDIT_TO_AED_RATE = 1.9;

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

type ListingMatchStatsRow = {
  listing_key: string;
  listing_id: string | null;
  reference: string | null;
  group_name: string | null;
  category: string | null;
  matched_amo_leads: number | string;
  spam_count: number | string;
  qualified_count: number | string;
  ql_actual_count: number | string;
  meetings_count: number | string;
  deals_count: number | string;
  revenue_sum: number | string;
  matched_amo_leads_by_month: Record<string, number> | null;
  spam_by_month: Record<string, number> | null;
  qualified_by_month: Record<string, number> | null;
  ql_actual_by_month: Record<string, number> | null;
  meetings_by_month: Record<string, number> | null;
  deals_by_month: Record<string, number> | null;
  revenue_by_month: Record<string, number> | null;
};

type ListingMatchStats = {
  crm_leads: number;
  spam: number;
  qualified_leads: number;
  ql_actual: number;
  meetings: number;
  deals: number;
  revenue: number;
  crm_leads_by_month: Record<string, number>;
  spam_by_month: Record<string, number>;
  qualified_leads_by_month: Record<string, number>;
  ql_actual_by_month: Record<string, number>;
  meetings_by_month: Record<string, number>;
  deals_by_month: Record<string, number>;
  revenue_by_month: Record<string, number>;
};

function normalizeListingRef(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

function parseDateRangeToUnix(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return { startUnix: null as number | null, endUnix: null as number | null };

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { startUnix: null as number | null, endUnix: null as number | null };
  }

  return {
    startUnix: Math.floor(start.getTime() / 1000),
    endUnix: Math.floor(end.getTime() / 1000),
  };
}

type ExactListingMetrics = {
  crm_leads: number;
  spam: number;
  qualified_leads: number;
  ql_actual: number;
  meetings: number;
  deals: number;
};

async function loadExactListingMetricsFromSyncState(
  listingRefs: string[],
  startDate: string | null,
  endDate: string | null,
) {
  if (listingRefs.length === 0) return new Map<string, ExactListingMetrics>();

  const { startUnix, endUnix } = parseDateRangeToUnix(startDate, endDate);

  const { rows } = await queryPostgres<{
    listing_ref: string;
    crm_leads: number | string;
    spam_count: number | string;
    qualified_count: number | string;
    ql_actual_count: number | string;
    meetings_count: number | string;
    deals_count: number | string;
  }>(
    `
      SELECT
        LOWER(TRIM(COALESCE(payload->>'pf_listing_ref', payload->>'listingRef', ''))) AS listing_ref,
        COUNT(*)::int AS crm_leads,
        SUM(CASE WHEN LOWER(COALESCE(payload->>'isSpam', 'false')) = 'true' THEN 1 ELSE 0 END)::int AS spam_count,
        SUM(CASE WHEN LOWER(COALESCE(payload->>'isQualified', 'false')) = 'true' THEN 1 ELSE 0 END)::int AS qualified_count,
        SUM(CASE WHEN LOWER(COALESCE(payload->>'isQlActual', 'false')) = 'true' THEN 1 ELSE 0 END)::int AS ql_actual_count,
        SUM(CASE WHEN LOWER(COALESCE(payload->>'isMeeting', 'false')) = 'true' THEN 1 ELSE 0 END)::int AS meetings_count,
        SUM(CASE WHEN LOWER(COALESCE(payload->>'isDeal', 'false')) = 'true' THEN 1 ELSE 0 END)::int AS deals_count
      FROM pf_amo_sync_state
      WHERE LOWER(TRIM(COALESCE(payload->>'pf_listing_ref', payload->>'listingRef', ''))) = ANY($1::text[])
        AND (
          LOWER(COALESCE(payload->>'pf_category', '')) = 'listing'
          OR LOWER(COALESCE(payload->>'entityType', '')) = 'listing'
        )
        AND (
          $2::bigint IS NULL
          OR (
            CASE
              WHEN (payload->>'created_at') ~ '^[0-9]+$'
                THEN (payload->>'created_at')::bigint >= $2::bigint
              WHEN payload->>'createdAt' IS NOT NULL
                THEN EXTRACT(EPOCH FROM (payload->>'createdAt')::timestamptz)::bigint >= $2::bigint
              ELSE true
            END
          )
        )
        AND (
          $3::bigint IS NULL
          OR (
            CASE
              WHEN (payload->>'created_at') ~ '^[0-9]+$'
                THEN (payload->>'created_at')::bigint <= $3::bigint
              WHEN payload->>'createdAt' IS NOT NULL
                THEN EXTRACT(EPOCH FROM (payload->>'createdAt')::timestamptz)::bigint <= $3::bigint
              ELSE true
            END
          )
        )
      GROUP BY 1
    `,
    [listingRefs, startUnix, endUnix],
  );

  const out = new Map<string, ExactListingMetrics>();
  for (const row of rows) {
    out.set(String(row.listing_ref || '').toLowerCase(), {
      crm_leads: Number(row.crm_leads || 0),
      spam: Number(row.spam_count || 0),
      qualified_leads: Number(row.qualified_count || 0),
      ql_actual: Number(row.ql_actual_count || 0),
      meetings: Number(row.meetings_count || 0),
      deals: Number(row.deals_count || 0),
    });
  }
  return out;
}

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
  // Strict mode for non-plan-fact pages: include a month bucket only when
  // the entire month is inside the requested date range.
  if (startDate && monthStart < startDate) return false;
  if (endDate && monthEnd > endDate) return false;
  return true;
}

async function loadListingMatchStatsFromPostgres(targetGroup: string | null) {
  const { rows } = await queryPostgres<ListingMatchStatsRow>(
    `
      SELECT DISTINCT ON (listing_key)
        listing_key,
        listing_id,
        reference,
        group_name,
        category,
        matched_amo_leads,
        spam_count,
        qualified_count,
        ql_actual_count,
        meetings_count,
        deals_count,
        revenue_sum,
        matched_amo_leads_by_month,
        spam_by_month,
        qualified_by_month,
        ql_actual_by_month,
        meetings_by_month,
        deals_by_month,
        revenue_by_month
      FROM pf_amo_match_listing_stats
      WHERE ($1::text IS NULL OR group_name = $1::text)
      ORDER BY listing_key, updated_at DESC
    `,
    [targetGroup],
  );

  const out = new Map<string, ListingMatchStats>();
  for (const row of rows) {
    const stats: ListingMatchStats = {
      crm_leads: Number(row.matched_amo_leads || 0),
      spam: Number(row.spam_count || 0),
      qualified_leads: Number(row.qualified_count || 0),
      ql_actual: Number(row.ql_actual_count || 0),
      meetings: Number(row.meetings_count || 0),
      deals: Number(row.deals_count || 0),
      revenue: Number(row.revenue_sum || 0),
      crm_leads_by_month: row.matched_amo_leads_by_month || {},
      spam_by_month: row.spam_by_month || {},
      qualified_leads_by_month: row.qualified_by_month || {},
      ql_actual_by_month: row.ql_actual_by_month || {},
      meetings_by_month: row.meetings_by_month || {},
      deals_by_month: row.deals_by_month || {},
      revenue_by_month: row.revenue_by_month || {},
    };
    if (row.listing_id) out.set(String(row.listing_id), stats);
    const ref = normalizeListingRef(row.reference);
    if (ref && !out.has(ref)) out.set(ref, stats);
  }
  return out;
}

async function loadMatchStatsRowsFromPostgres(startDate: string | null, endDate: string | null) {
  const { rows } = await queryPostgres<MatchStatsRow>(
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

  return rows;
}

async function loadListingsFromPostgres(targetGroup: string | null) {
  // Partner group includes AbuDhabi listings too
  const groupFilter = targetGroup === 'Partner'
    ? `group_name IN ('Partner', 'AbuDhabi')`
    : targetGroup
      ? `group_name = '${targetGroup.replace(/'/g, "''")}'`
      : `1=1`;

  const { rows } = await queryPostgres<ListingSnapshotRow>(
    `
      SELECT listing_id, reference, group_name, category, offering_type, title, status,
              budget, budget_by_month, leads_count, leads_by_month, source_updated_at, payload
      FROM pf_listings_snapshot
      WHERE ${groupFilter}
    `,
    [],
  );

  return rows.map((row: ListingSnapshotRow) => ({
    ListingId: row.listing_id,
    Reference: row.reference || row.listing_id,
    group: row.group_name || 'Our',
    GroupName: row.group_name || 'Our',
    Category:
      row.category ||
      (row.offering_type === 'sale' ? 'Sell' : row.offering_type === 'rent' ? 'Rent' : 'Other'),
    Title: row.title || row.reference || row.listing_id,
    status: row.status || 'Active',
    Budget: (Number(row.budget || 0) || 0) * CREDIT_TO_AED_RATE,
    BudgetByMonth: Object.fromEntries(Object.entries(row.budget_by_month || {}).map(([k, v]) => [k, Number(v) * CREDIT_TO_AED_RATE])),

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

export async function GET(request: Request) {
  try {
    if (!isPostgresConfigured()) {
      return NextResponse.json(
        { success: false, error: 'PostgreSQL is required for /api/pf-listings. Fallbacks are disabled.' },
        { status: 503 },
      );
    }

    const { searchParams } = new URL(request.url);
    const targetGroup = searchParams.get('group'); // 'Our' or 'Partner'
    const viewMode = searchParams.get('view');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Exact day-range metrics for "Our" group (no monthly aggregation in UI responses)
    if (targetGroup === 'Our') {
      const ourListings = await loadListingsFromPostgres('Our');
      const referenceSet = Array.from(
        new Set(
          ourListings
            .map((l: any) => normalizeListingRef(l.Reference))
            .filter(Boolean),
        ),
      );
      const exactMetrics = await loadExactListingMetricsFromSyncState(referenceSet, startDate, endDate);

      const categorySort: Record<string, number> = {
        'Sell': 1, 'Rent': 2, 'Commercial Sell': 3, 'Commercial Rent': 4, 'Other': 5,
      };

      const formattedRows: any[] = [];

      for (const listing of ourListings) {
        const ref = normalizeListingRef(listing.Reference);
        const metrics = ref ? exactMetrics.get(ref) : null;
        const crmLeads = Number(metrics?.crm_leads || 0);
        if (crmLeads <= 0) continue;

        const spam = Number(metrics?.spam || 0);
        const qualified = Number(metrics?.qualified_leads || 0);
        const qlActual = Number(metrics?.ql_actual || 0);
        const meetings = Number(metrics?.meetings || 0);
        const deals = Number(metrics?.deals || 0);
        const budget = Number(listing.Budget || 0);

        const category = listing.Category || 'Other';
        const listingTitle = listing.Title || listing.Reference || listing.ListingId;
        const sortOrder = categorySort[category] || 99;

        formattedRows.push({
          channel: 'Property Finder',
          level_1: category,
          level_2: listingTitle,
          level_3: null,
          budget,
          leads: crmLeads,
          crm_leads: crmLeads,
          no_answer_spam: spam,
          qualified_leads: qualified,
          ql_actual: qlActual,
          meetings,
          deals,
          revenue: 0,
          company_revenue: 0,
          date: startDate && endDate ? `${startDate}..${endDate}` : '-',
          cpl: crmLeads > 0 ? budget / crmLeads : 0,
          rate_answer: crmLeads > 0 ? (crmLeads - spam) / crmLeads : 0,
          cost_per_qualified_leads: qualified > 0 ? budget / qualified : 0,
          cpql_actual: qlActual > 0 ? budget / qlActual : 0,
          cp_meetings: meetings > 0 ? budget / meetings : 0,
          cost_per_deal: deals > 0 ? budget / deals : 0,
          roi: 0,
          cr_ql: crmLeads > 0 ? qualified / crmLeads : 0,
          sort_order: sortOrder,
          status: listing.status || 'Active',
        });
      }

      return NextResponse.json({ success: true, data: formattedRows, meta: { lastUpdatedAt: new Date().toISOString() } });
    }

    // Exact day-range metrics for Partner group (no monthly aggregation in UI responses)
    if (targetGroup === 'Partner') {
      const partnerListings = await loadListingsFromPostgres('Partner');
      const referenceSet = Array.from(
        new Set(
          partnerListings
            .map((l: any) => normalizeListingRef(l.Reference))
            .filter(Boolean),
        ),
      );
      const exactMetrics = await loadExactListingMetricsFromSyncState(referenceSet, startDate, endDate);

      const categorySort: Record<string, number> = {
        'Sell': 1, 'Rent': 2, 'Commercial Sell': 3, 'Commercial Rent': 4, 'Other': 5,
      };

      const formattedRows: any[] = [];

      for (const listing of partnerListings) {
        const ref = normalizeListingRef(listing.Reference);
        const metrics = ref ? exactMetrics.get(ref) : null;
        const crmLeads = Number(metrics?.crm_leads || 0);
        if (crmLeads <= 0) continue;

        const spam = Number(metrics?.spam || 0);
        const qualified = Number(metrics?.qualified_leads || 0);
        const qlActual = Number(metrics?.ql_actual || 0);
        const meetings = Number(metrics?.meetings || 0);
        const deals = Number(metrics?.deals || 0);
        const budget = Number(listing.Budget || 0);

        const category = listing.Category || 'Other';
        const listingTitle = listing.Title || listing.Reference || listing.ListingId;
        const sortOrder = categorySort[category] || 99;

        formattedRows.push({
          channel: 'Property Finder',
          level_1: category,
          level_2: listingTitle,
          level_3: null,
          budget,
          leads: crmLeads,
          crm_leads: crmLeads,
          no_answer_spam: spam,
          qualified_leads: qualified,
          ql_actual: qlActual,
          meetings,
          deals,
          revenue: 0,
          company_revenue: 0,
          date: startDate && endDate ? `${startDate}..${endDate}` : '-',
          cpl: crmLeads > 0 ? budget / crmLeads : 0,
          rate_answer: crmLeads > 0 ? (crmLeads - spam) / crmLeads : 0,
          cost_per_qualified_leads: qualified > 0 ? budget / qualified : 0,
          cpql_actual: qlActual > 0 ? budget / qlActual : 0,
          cp_meetings: meetings > 0 ? budget / meetings : 0,
          cost_per_deal: deals > 0 ? budget / deals : 0,
          roi: 0,
          cr_ql: crmLeads > 0 ? qualified / crmLeads : 0,
          sort_order: sortOrder,
          status: listing.status || 'Active',
        });
      }

      return NextResponse.json({ success: true, data: formattedRows, meta: { lastUpdatedAt: new Date().toISOString() } });
    }

    // Legacy amo-category-summary path (kept for backwards compat)
    if (viewMode === 'amo-category-summary') {
      const statsRows = await loadMatchStatsRowsFromPostgres(startDate, endDate);
      const partnerListings = await loadListingsFromPostgres('Partner');

      const monthInRange = (monthKey: string) => {
        return monthKeyOverlapsRange(monthKey, startDate, endDate);
      };

      const dateInRange = (dateString?: string | null) => {
        if (!startDate || !endDate) return true;
        if (!dateString) return true;
        const normalized = dateString.slice(0, 10);
        return normalized >= startDate && normalized <= endDate;
      };

      const budgetByCategory: Record<string, number> = {
        Sell: 0,
        Rent: 0,
        'Commercial Sell': 0,
        'Commercial Rent': 0,
        Other: 0,
      };

      for (const listing of partnerListings) {
        const category =
          listing.Category === 'Sell' || listing.Category === 'Rent' ||
          listing.Category === 'Commercial Sell' || listing.Category === 'Commercial Rent'
            ? listing.Category
            : 'Other';

        const budgetByMonth = listing.BudgetByMonth || {};
        const months = Object.keys(budgetByMonth);

        if (months.length > 0) {
          const categoryBudget = months
            .filter((m) => monthInRange(m))
            .reduce((sum, m) => sum + Number(budgetByMonth[m] || 0), 0);
          budgetByCategory[category] += categoryBudget;
        } else {
          if (dateInRange(listing.CreatedAt || null)) {
            budgetByCategory[category] += Number(listing.Budget || 0);
          }
        }
      }

      const categoryAgg: Record<string, {
        pf_leads: number;
        matched_amo_leads: number;
        spam_count: number;
        qualified_count: number;
        ql_actual_count: number;
        meetings_count: number;
        deals_count: number;
        revenue_sum: number;
      }> = {};

      for (const row of statsRows) {
        const category =
          row.category === 'Sell' || row.category === 'Rent' ||
          row.category === 'Commercial Sell' || row.category === 'Commercial Rent'
            ? row.category
            : 'Other';

        if (!categoryAgg[category]) {
          categoryAgg[category] = {
            pf_leads: 0,
            matched_amo_leads: 0,
            spam_count: 0,
            qualified_count: 0,
            ql_actual_count: 0,
            meetings_count: 0,
            deals_count: 0,
            revenue_sum: 0,
          };
        }

        categoryAgg[category].pf_leads += Number(row.pf_leads || 0);
        categoryAgg[category].matched_amo_leads += Number(row.matched_amo_leads || 0);
        categoryAgg[category].spam_count += Number(row.spam_count || 0);
        categoryAgg[category].qualified_count += Number(row.qualified_count || 0);
        categoryAgg[category].ql_actual_count += Number(row.ql_actual_count || 0);
        categoryAgg[category].meetings_count += Number(row.meetings_count || 0);
        categoryAgg[category].deals_count += Number(row.deals_count || 0);
        categoryAgg[category].revenue_sum += Number(row.revenue_sum || 0);
      }

      const categorySort: Record<string, number> = {
        Sell: 1,
        Rent: 2,
        'Commercial Sell': 3,
        'Commercial Rent': 4,
        Other: 5,
      };

      const formattedRows = Object.entries(categoryAgg).map(([category, v]) => {
        const matched = v.matched_amo_leads;
        const categoryBudget = Number(budgetByCategory[category] || 0);
        return {
          channel: 'Property Finder',
          level_1: category,
          level_2: null,
          level_3: null,
          budget: categoryBudget,
          leads: v.pf_leads,
          no_answer_spam: v.spam_count,
          qualified_leads: matched,
          ql_actual: v.ql_actual_count,
          meetings: v.meetings_count,
          deals: v.deals_count,
          revenue: v.revenue_sum,
          company_revenue: 0,
          date: '-',
          cpl: v.pf_leads > 0 ? categoryBudget / v.pf_leads : 0,
          sort_order: categorySort[category] || 99,
          status: 'Active',
          rate_answer: v.pf_leads > 0 ? matched / v.pf_leads : 0,
          cost_per_qualified_leads: matched > 0 ? categoryBudget / matched : 0,
          cpql_actual: v.ql_actual_count > 0 ? categoryBudget / v.ql_actual_count : 0,
          cp_meetings: v.meetings_count > 0 ? categoryBudget / v.meetings_count : 0,
          cost_per_deal: v.deals_count > 0 ? categoryBudget / v.deals_count : 0,
          roi: categoryBudget > 0 ? v.revenue_sum / categoryBudget : 0,
          cr_ql: v.pf_leads > 0 ? matched / v.pf_leads : 0,
        };
      });

      formattedRows.sort((a, b) => a.sort_order - b.sort_order);

      let lastUpdatedAt: string | null = null;
      try {
        const { rows: freshRows } = await queryPostgres<{ max_synced: string | null }>(
          `SELECT MAX(updated_at)::text AS max_synced FROM pf_amo_match_stats`,
          [],
        );
        lastUpdatedAt = freshRows[0]?.max_synced ?? null;
      } catch {
        // ignore freshness errors for summary mode
      }

      return NextResponse.json({ success: true, data: formattedRows, meta: { lastUpdatedAt } });
    }

    let rawData: any[] = [];
    let listingMatchStats = new Map<string, ListingMatchStats>();

    rawData = await loadListingsFromPostgres(targetGroup);
    // Note: listingMatchStats only needed for Partner group at this point
    // since Our group is handled above and returns early

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

    // Partner group also includes AbuDhabi
    const filteredData = targetGroup === 'Partner'
      ? rawData.filter((l: any) => l.group === 'Partner' || l.group === 'AbuDhabi')
      : targetGroup
        ? rawData.filter((l: any) => l.group === targetGroup)
        : rawData;

    filteredData.forEach((l: any) => {
      const listingLeadsPf = Number(l.LeadsPF || 0);
      const listingCompRevenue = 0;
      const listingKey = String(l.ListingId || l.listing_id || '').trim();
      const referenceKey = normalizeListingRef(l.Reference);
      const amoData = listingMatchStats.get(listingKey) || listingMatchStats.get(referenceKey) || null;
      const amoCrmLeadsByMonth = amoData?.crm_leads_by_month || {};
      const amoSpamByMonth = amoData?.spam_by_month || {};
      const amoQualifiedByMonth = amoData?.qualified_leads_by_month || {};
      const amoQlActualByMonth = amoData?.ql_actual_by_month || {};
      const amoMeetingsByMonth = amoData?.meetings_by_month || {};
      const amoDealsByMonth = amoData?.deals_by_month || {};
      const amoRevenueByMonth = amoData?.revenue_by_month || {};
      
      const isUnattributedRow = targetGroup === 'Our' && (l.ListingId === 'pf-unattributed-listing-leads' || l.Title === 'Unattributed');
      const listingLabel = l.Title && l.Title.length > 30 ? `${l.Title.slice(0, 30)}...` : (l.Title || l.Reference);
      const categoryLabel = isUnattributedRow ? 'Unattributed' : l.Category;
      const sort_order =
        categoryLabel === 'Sell'
          ? 1
          : categoryLabel === 'Rent'
            ? 2
            : categoryLabel === 'Commercial Sell'
              ? 3
              : categoryLabel === 'Commercial Rent'
                ? 4
                : categoryLabel === 'Unattributed'
                  ? 5
                  : 6;

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
          const crmLeads = Number(amoCrmLeadsByMonth[month] || 0);
          const spam = Number(amoSpamByMonth[month] || 0);
          const useSpamLeadBase = false; // Always use CRM leads as "leads" column
          const useCrmLeadBase = true;
          const leadBase = useSpamLeadBase ? spam : (useCrmLeadBase ? crmLeads : monthLeads);
          const qualifiedLeads = Number(amoQualifiedByMonth[month] || 0);
          const qlActual = Number(amoQlActualByMonth[month] || 0);
          const meetings = Number(amoMeetingsByMonth[month] || 0);
          const deals = Number(amoDealsByMonth[month] || 0);
          const revenue = Number(amoRevenueByMonth[month] || 0);
          formattedRows.push({
            channel: 'Property Finder',
            level_1: categoryLabel,
            level_2: listingLabel,
            level_3: month,
            budget: Number(budgetByMonth[month] || 0),
            leads: leadBase,
            crm_leads: crmLeads,
            no_answer_spam: spam,
            qualified_leads: qualifiedLeads,
            ql_actual: qlActual,
            meetings: meetings,
            deals: deals,
            revenue: revenue,
            company_revenue: 0,
            date: month,
            cpl: leadBase > 0 ? Number(budgetByMonth[month] || 0) / leadBase : 0,
            rate_answer: crmLeads > 0 ? (crmLeads - spam) / crmLeads : 0,
            cost_per_qualified_leads: qualifiedLeads > 0 ? Number(budgetByMonth[month] || 0) / qualifiedLeads : 0,
            cpql_actual: qlActual > 0 ? Number(budgetByMonth[month] || 0) / qlActual : 0,
            cp_meetings: meetings > 0 ? Number(budgetByMonth[month] || 0) / meetings : 0,
            cost_per_deal: deals > 0 ? Number(budgetByMonth[month] || 0) / deals : 0,
            roi: Number(budgetByMonth[month] || 0) > 0 ? revenue / Number(budgetByMonth[month] || 0) : 0,
            cr_ql: leadBase > 0 ? qualifiedLeads / leadBase : 0,
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
        const crmLeads = Number(amoData?.crm_leads || 0);
        const spam = Number(amoData?.spam || 0);
        const qualifiedLeads = Number(amoData?.qualified_leads || 0);
        const qlActual = Number(amoData?.ql_actual || 0);
        const meetings = Number(amoData?.meetings || 0);
        const deals = Number(amoData?.deals || 0);
        const revenue = Number(amoData?.revenue || 0);
        const pfLeadBase = rangedLeads || listingLeadsPf;
        const leadBase = useSpamLeadBase ? spam : (useCrmLeadBase ? crmLeads : pfLeadBase);
        formattedRows.push({
          channel: 'Property Finder',
          level_1: categoryLabel,
          level_2: listingLabel,
          level_3: null,
          budget: Number(l.Budget || 0),
          leads: leadBase,
          crm_leads: crmLeads,
          no_answer_spam: spam,
          qualified_leads: qualifiedLeads,
          ql_actual: qlActual,
          meetings: meetings,
          deals: deals,
          revenue: revenue,
          company_revenue: listingCompRevenue,
          date: l.CreatedAt ? l.CreatedAt.slice(0, 10) : '-',
          cpl: leadBase > 0 ? Number(l.Budget || 0) / leadBase : 0,
          rate_answer: crmLeads > 0 ? (crmLeads - spam) / crmLeads : 0,
          cost_per_qualified_leads: qualifiedLeads > 0 ? Number(l.Budget || 0) / qualifiedLeads : 0,
          cpql_actual: qlActual > 0 ? Number(l.Budget || 0) / qlActual : 0,
          cp_meetings: meetings > 0 ? Number(l.Budget || 0) / meetings : 0,
          cost_per_deal: deals > 0 ? Number(l.Budget || 0) / deals : 0,
          roi: Number(l.Budget || 0) > 0 ? revenue / Number(l.Budget || 0) : 0,
          cr_ql: leadBase > 0 ? qualifiedLeads / leadBase : 0,
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

    // Fetch last sync time for freshness status
    let lastUpdatedAt: string | null = null;
    if (isPostgresConfigured()) {
      try {
        const { rows: freshRows } = await queryPostgres<{ max_synced: string | null }>(
          `SELECT MAX(synced_at)::text AS max_synced FROM pf_listings_snapshot`,
          [],
        );
        lastUpdatedAt = freshRows[0]?.max_synced ?? null;
      } catch { /* ignore */ }
    }

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

    return NextResponse.json({ success: true, data: formattedRows, meta: { lastUpdatedAt } });

  } catch (error: any) {
    console.error('API ERROR (PF Listings):', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
