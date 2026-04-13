import { BigQuery } from '@google-cloud/bigquery';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import path from 'path';
import fs from 'fs';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
// Note: In production, use env variables. For now, referencing existing secret.
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE
});

export default async function GoBridgePage({
    params,
    searchParams,
}: {
    params: { slug: string };
    searchParams: { [key: string]: string | undefined };
}) {
    const { slug } = params;
    const utm_source = searchParams.utm_source || 'direct';
    const utm_campaign = searchParams.utm_campaign || slug;
    const utm_medium = searchParams.utm_medium || 'social';
    const utm_content = searchParams.utm_content || '';
    
    // Default WhatsApp Number (Can be made dynamic)
    const wa_number = searchParams.wa || '971501769699'; 
    const click_id = `C-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Get client info
    const h = await headers();
    const userAgent = h.get('user-agent') || 'Unknown';
    const ip = h.get('x-forwarded-for') || '127.0.0.1';

    // 1. Record Click to BigQuery (Async-ish)
    // 1.1 Also create lead in amoCRM immediately!
    try {
        const table = bq.dataset(DATASET_ID).table('marketing_clicks_raw');
        await table.insert([{
            click_id,
            click_time: bq.timestamp(new Date()),
            utm_source,
            utm_campaign,
            utm_medium,
            utm_content,
            ip_address: ip.split(',')[0],
            user_agent: userAgent,
            target_wa_number: wa_number,
            is_converted: false
        }]);

        // 1.2 Call amoCRM to create a ghost lead
        const tokens = JSON.parse(fs.readFileSync(path.resolve('./secrets/amo_tokens.json'), 'utf8'));
        const domain = 'reforyou.amocrm.ru';
        await fetch(`https://${domain}/api/v4/leads`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${tokens.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify([{
                name: `[CLICK] ${utm_source}: ${slug}`,
                custom_fields_values: [
                    { field_id: 683939, values: [{ value: utm_source }] }, // UTM Source
                    { field_id: 683937, values: [{ value: utm_campaign }] }, // UTM Campaign
                    { field_id: 683935, values: [{ value: utm_medium }] }, // UTM Medium
                    { field_id: 683933, values: [{ value: utm_content }] }, // UTM Content
                    { field_id: 1343875, values: [{ value: `ClickID: ${click_id}\nIP: ${ip}\nAgent: ${userAgent}` }] } // COMMENT
                ]
            }])
        });
    } catch (e) {
        console.error('Logging/CRM Creation Failed:', e);
    }

    // 2. Format WhatsApp Redirect
    const waText = `Hello! I am interested in ${slug.replace(/-/g, ' ')}. [ID: ${click_id}]`;
    const waUrl = `https://wa.me/${wa_number}?text=${encodeURIComponent(waText)}`;

    // 3. Goodbye! Redirecting...
    redirect(waUrl);
}
