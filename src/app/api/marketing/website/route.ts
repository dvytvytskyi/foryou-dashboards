import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { getSession } from '@/lib/auth';
import { bigQueryQuery } from '@/lib/bigqueryClient';
import { readGoogleCredentials } from '@/lib/googleAuth';

const GA4_PROPERTY_ID = '510214784';
const GSC_SITE_URL = 'sc-domain:foryou-realestate.com';

function getYYYYMMDD(d: Date) {
    return d.toISOString().split('T')[0];
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    try {
        const credentials = readGoogleCredentials();

        // Init client inside the handler with fallback: true to use REST API instead of gRPC
        // This prevents the "Name resolution failed for target dns:analyticsdata.googleapis.com:443" error
        const analyticsDataClient = new BetaAnalyticsDataClient({ 
            credentials,
            fallback: true
        });
        
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const startDate = searchParams.get('startDate') || '30daysAgo';
        const endDate = searchParams.get('endDate') || 'today';

        // 1. Fetch from GA4
        const [gaResponse] = await analyticsDataClient.runReport({
            property: `properties/${GA4_PROPERTY_ID}`,
            dateRanges: [{ startDate, endDate }],
            dimensions: [
                { name: 'sessionDefaultChannelGroup' },
                { name: 'sessionSource' },
                { name: 'sessionMedium' },
                { name: 'sessionCampaignName' }
            ],
            metrics: [
                { name: 'sessions' },
                { name: 'bounceRate' },
                { name: 'averageSessionDuration' },
                { name: 'advertiserAdClicks' },
                { name: 'advertiserAdCost' },
                { name: 'advertiserAdImpressions' }
            ],
        });

        // 1.5 Fetch total impressions and clicks from Google Search Console
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
        });
        const searchconsole = google.searchconsole({ version: 'v1', auth });
        
        let gscTotals = { impressions: 0, clicks: 0 };
        try {
            const gscRes = await searchconsole.searchanalytics.query({
                siteUrl: GSC_SITE_URL,
                requestBody: {
                    startDate: startDate === '30daysAgo' ? getYYYYMMDD(new Date(Date.now() - 30*24*60*60*1000)) : startDate,
                    endDate: endDate === 'today' ? getYYYYMMDD(new Date()) : endDate,
                    // No dimensions provided means it returns grand totals for the site!
                }
            });
            if (gscRes.data.rows && gscRes.data.rows.length > 0) {
                gscTotals.impressions = gscRes.data.rows[0].impressions || 0;
                gscTotals.clicks = gscRes.data.rows[0].clicks || 0;
            }
        } catch (e) {
            console.error('Failed to fetch GSC totals:', e);
        }

        // Parse GA4
        const gaData: Record<string, any> = {};
        if (gaResponse.rows) {
            gaResponse.rows.forEach(row => {
                const channel = row.dimensionValues?.[0].value || '(not set)';
                const source = row.dimensionValues?.[1].value || '(not set)';
                const medium = row.dimensionValues?.[2].value || '(not set)';
                const campaign = row.dimensionValues?.[3].value || '(not set)';
                
                const sessions = parseInt(row.metricValues?.[0].value || '0', 10);
                const bounceRate = parseFloat(row.metricValues?.[1].value || '0');
                const avgDuration = parseFloat(row.metricValues?.[2].value || '0');
                const clicks = parseInt(row.metricValues?.[3].value || '0', 10);
                const adCost = parseFloat(row.metricValues?.[4].value || '0');
                const impressions = parseInt(row.metricValues?.[5].value || '0', 10);

                const key = `${channel}|${source}|${medium}|${campaign}`;
                gaData[key] = {
                    channel,
                    level_1: source === '(not set)' ? null : source,
                    level_2: medium === '(not set)' ? null : medium,
                    level_3: campaign === '(not set)' ? null : campaign,
                    sessions,
                    bounce_rate: bounceRate,
                    avg_duration: avgDuration,
                    clicks,
                    ad_cost: adCost,
                    impressions,
                    leads_crm: 0,
                    leads_wa: 0,
                    no_answer: 0,
                    qualified_leads: 0,
                    meetings: 0,
                    deals: 0,
                    revenue: 0,
                };
            });
        }

        // 2. Fetch from BigQuery for AmoCRM Website leads
        const bqRows = await bigQueryQuery({
            query: `
                SELECT 
                    level_1, 
                    level_2, 
                    level_3,
                    SUM(leads) as leads_crm,
                    SUM(no_answer_spam) as no_answer,
                    SUM(qualified_leads) as qualified_leads,
                    SUM(meetings) as meetings,
                    SUM(deals) as deals,
                    SUM(revenue) as revenue
                FROM \`crypto-world-epta.foryou_analytics.marketing_channel_drilldown_daily\`
                WHERE report_date BETWEEN @startDate AND @endDate
                  AND channel = 'Website'
                GROUP BY level_1, level_2, level_3
            `,
            params: { startDate, endDate }
        });

        // 3. Merge BigQuery data into GA4 data
        (bqRows || []).forEach((r: any) => {
            const source = (r.level_1 || '(not set)').toLowerCase();
            const medium = (r.level_2 || '(not set)').toLowerCase();
            const campaign = (r.level_3 || '(not set)').toLowerCase();

            // Try to find a match in GA4 data by source, medium, campaign
            let matchedKey = Object.keys(gaData).find(k => k.toLowerCase().endsWith(`|${source}|${medium}|${campaign}`));
            
            // Fallback match: just source and medium
            if (!matchedKey) {
                 matchedKey = Object.keys(gaData).find(k => k.toLowerCase().includes(`|${source}|${medium}|`));
            }
            
            // Fallback match: just source
            if (!matchedKey) {
                 matchedKey = Object.keys(gaData).find(k => k.toLowerCase().includes(`|${source}|`));
            }

            if (matchedKey) {
                gaData[matchedKey].leads_crm += Number(r.leads_crm || 0);
                gaData[matchedKey].no_answer += Number(r.no_answer || 0);
                gaData[matchedKey].qualified_leads += Number(r.qualified_leads || 0);
                gaData[matchedKey].meetings += Number(r.meetings || 0);
                gaData[matchedKey].deals += Number(r.deals || 0);
                gaData[matchedKey].revenue += Number(r.revenue || 0);
            } else {
                // If no GA4 data matches, create a new row for CRM data
                const key = `Website CRM|${r.level_1 || '(not set)'}|${r.level_2 || '(not set)'}|${r.level_3 || '(not set)'}`;
                gaData[key] = {
                    channel: 'Website CRM (No GA4 match)',
                    level_1: r.level_1,
                    level_2: r.level_2,
                    level_3: r.level_3,
                    sessions: 0,
                    bounce_rate: 0,
                    avg_duration: 0,
                    clicks: 0,
                    ad_cost: 0,
                    impressions: 0,
                    leads_crm: Number(r.leads_crm || 0),
                    leads_wa: 0,
                    no_answer: Number(r.no_answer || 0),
                    qualified_leads: Number(r.qualified_leads || 0),
                    meetings: Number(r.meetings || 0),
                    deals: Number(r.deals || 0),
                    revenue: Number(r.revenue || 0),
                };
            }
        });

        // 4. Inject GSC Organic totals into the Organic Search channel
        const organicKey = Object.keys(gaData).find(k => k.startsWith('Organic Search|'));
        if (organicKey) {
            gaData[organicKey].impressions += gscTotals.impressions;
            gaData[organicKey].clicks += gscTotals.clicks;
        } else if (gscTotals.impressions > 0 || gscTotals.clicks > 0) {
            const key = 'Organic Search|(not set)|(not set)|(not set)';
            gaData[key] = {
                channel: 'Organic Search',
                level_1: null, level_2: null, level_3: null,
                sessions: 0, bounce_rate: 0, avg_duration: 0, ad_cost: 0,
                leads_crm: 0, leads_wa: 0, no_answer: 0, qualified_leads: 0, meetings: 0, deals: 0, revenue: 0,
                impressions: gscTotals.impressions,
                clicks: gscTotals.clicks
            };
        }

        const data = Object.values(gaData).sort((a: any, b: any) => {
            if (b.sessions !== a.sessions) return b.sessions - a.sessions;
            return b.leads_crm - a.leads_crm;
        });

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Website API error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
