import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { getSession } from '@/lib/auth';

const GA4_PROPERTY_ID = '510214784';
const keyFilename = 'crypto-world-epta-3d8cb91d7676.json';
const GSC_SITE_URL = 'sc-domain:foryou-realestate.com';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getYYYYMMDD(d: Date) {
    return d.toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        let startDate = searchParams.get('startDate');
        let endDate = searchParams.get('endDate');

        if (!startDate || startDate === '30daysAgo') {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            startDate = getYYYYMMDD(d);
        }
        if (!endDate || endDate === 'today') {
            endDate = getYYYYMMDD(new Date());
        }

        const auth = new google.auth.GoogleAuth({
            keyFile: keyFilename,
            scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
        });
        const searchconsole = google.searchconsole({ version: 'v1', auth });
        
        // Init client with fallback: true to use REST API instead of gRPC
        const analyticsDataClient = new BetaAnalyticsDataClient({ 
            keyFilename,
            fallback: true
        });

        // 1. Fetch Queries from GSC
        const queriesRes = await searchconsole.searchanalytics.query({
            siteUrl: GSC_SITE_URL,
            requestBody: {
                startDate,
                endDate,
                dimensions: ['query'],
                rowLimit: 50,
            }
        });

        // 2. Fetch Landing Pages from GSC
        const pagesRes = await searchconsole.searchanalytics.query({
            siteUrl: GSC_SITE_URL,
            requestBody: {
                startDate,
                endDate,
                dimensions: ['page'],
                rowLimit: 50,
            }
        });

        // 3. Fetch Landing Pages from GA4
        const [gaResponse] = await analyticsDataClient.runReport({
            property: `properties/${GA4_PROPERTY_ID}`,
            dateRanges: [{ startDate, endDate }],
            dimensions: [{ name: 'landingPagePlusQueryString' }],
            metrics: [
                { name: 'sessions' },
                { name: 'bounceRate' }
            ],
        });

        const gaPagesData: Record<string, any> = {};
        if (gaResponse.rows) {
            gaResponse.rows.forEach(row => {
                const lp = row.dimensionValues?.[0].value || '/';
                const sessions = parseInt(row.metricValues?.[0].value || '0', 10);
                const bounceRate = parseFloat(row.metricValues?.[1].value || '0');
                gaPagesData[lp] = { sessions, bounceRate };
            });
        }

        // Format Queries
        const queriesData = (queriesRes.data.rows || []).map(row => ({
            type: 'query',
            grouping: row.keys?.[0] || 'Unknown',
            impressions: row.impressions || 0,
            clicks: row.clicks || 0,
            ctr: row.ctr || 0,
            avg_position: row.position || 0,
            sessions: 0,
            bounce_rate: 0,
            leads_crm: 0,
            qualified_leads: 0,
            cost: 0,
            revenue: 0,
            status: '—'
        }));

        // Format Pages
        const pagesData = (pagesRes.data.rows || []).map(row => {
            let urlPath = row.keys?.[0] || 'Unknown';
            // Extract path from full URL
            if (urlPath.startsWith('http')) {
                try {
                    const u = new URL(urlPath);
                    urlPath = u.pathname + u.search;
                } catch(e) {}
            }
            
            const gaData = gaPagesData[urlPath] || { sessions: 0, bounceRate: 0 };

            return {
                type: 'page',
                grouping: urlPath,
                impressions: row.impressions || 0,
                clicks: row.clicks || 0,
                ctr: row.ctr || 0,
                avg_position: row.position || 0,
                sessions: gaData.sessions,
                bounce_rate: gaData.bounceRate,
                leads_crm: 0,
                qualified_leads: 0,
                cost: 0,
                revenue: 0,
                status: '—'
            };
        });

        return NextResponse.json({ 
            success: true, 
            data: {
                queries: queriesData,
                pages: pagesData
            } 
        });
    } catch (error: any) {
        console.error('SEO API error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
