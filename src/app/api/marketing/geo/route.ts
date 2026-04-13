
import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bqCredentials = process.env.GOOGLE_AUTH_JSON 
  ? JSON.parse(process.env.GOOGLE_AUTH_JSON)
  : undefined;

const bq = new BigQuery({
  projectId: 'crypto-world-epta',
  credentials: bqCredentials,
  keyFilename: !bqCredentials ? path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json') : undefined,
});

const RED_QUALIFIED_IDS = [70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802, 142];
const RED_ACTUAL_IDS = [70457466, 70457470, 70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802];
const RED_MEETING_IDS = [70457474, 70457478, 70457482, 70457486, 70757586, 74717798, 74717802, 142];
const RED_WON_ID = 142;
const RED_LOST_ID = 143;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || '2024-01-01';
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    const query = `
      WITH raw_data AS (
        SELECT * EXCEPT(row_num)
        FROM (
          SELECT 
            lead_id,
            lead_date,
            utm_source,
            ip_country,
            phone_country,
            status_id,
            potential_value as revenue,
            ROW_NUMBER() OVER(PARTITION BY lead_id ORDER BY lead_date DESC) as row_num
          FROM \`crypto-world-epta.foryou_analytics.marketing_geo_creative_hub\`
          WHERE lead_date BETWEEN @startDate AND @endDate
            AND channel_source = 'RED'
        )
        WHERE row_num = 1
      ),
      ip_stats AS (
        SELECT 
          'Country' as channel,
          SPLIT(ip_country, ',')[OFFSET(0)] as country,
          utm_source as campaign,
          count(*) as leads,
          countif(status_id = ${RED_LOST_ID}) as no_answer_spam,
          countif(status_id IN UNNEST(@qualified_ids)) as qualified_leads,
          countif(status_id IN UNNEST(@actual_ids)) as ql_actual,
          countif(status_id IN UNNEST(@meeting_ids)) as meetings,
          countif(status_id = ${RED_WON_ID}) as deals,
          sum(case when status_id = ${RED_WON_ID} then revenue else 0 end) as revenue
        FROM raw_data
        WHERE ip_country IS NOT NULL AND ip_country != ''
        GROUP BY country, campaign
      ),
      phone_stats AS (
        SELECT 
          'Phone' as channel,
          SPLIT(phone_country, ',')[OFFSET(0)] as country,
          utm_source as campaign,
          count(*) as leads,
          countif(status_id = ${RED_LOST_ID}) as no_answer_spam,
          countif(status_id IN UNNEST(@qualified_ids)) as qualified_leads,
          countif(status_id IN UNNEST(@actual_ids)) as ql_actual,
          countif(status_id IN UNNEST(@meeting_ids)) as meetings,
          countif(status_id = ${RED_WON_ID}) as deals,
          sum(case when status_id = ${RED_WON_ID} then revenue else 0 end) as revenue
        FROM raw_data
        WHERE phone_country IS NOT NULL AND phone_country != ''
        GROUP BY country, campaign
      )
      SELECT * FROM ip_stats
      UNION ALL
      SELECT * FROM phone_stats
      ORDER BY channel, leads DESC
    `;

    const [rows] = await bq.query({
      query,
      params: {
        startDate,
        endDate,
        qualified_ids: RED_QUALIFIED_IDS,
        actual_ids: RED_ACTUAL_IDS,
        meeting_ids: RED_MEETING_IDS,
      },
    });

    // Formatting for the DashboardPage component
    const formattedRows = rows.map((r: any) => {
        const leads = Number(r.leads) || 0;
        const ql = Number(r.qualified_leads) || 0;
        const no_answer_spam = Number(r.no_answer_spam) || 0;
        return {
            ...r,
            level_1: r.country,
            level_2: r.campaign,
            level_3: null,
            rate_answer: leads > 0 ? (leads - no_answer_spam) / leads : 0,
            cr_ql: leads > 0 ? ql / leads : 0,
            budget: 0, cpl: 0, cost_per_qualified_leads: 0, cpql_actual: 0, cp_meetings: 0, cost_per_deal: 0, roi: 0, company_revenue: 0,
            sort_order: r.channel === 'Country' ? 1 : 2
        };
    });

    return NextResponse.json({ success: true, data: formattedRows });
  } catch (error) {
    console.error('Geo API error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
