import { BigQuery } from '@google-cloud/bigquery';
import { NextResponse } from 'next/server';
import path from 'path';

const PROJECT_ID = 'crypto-world-epta';
const DATASET_ID = 'foryou_analytics';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const BOT_TOKEN = '8745230277:AAGhKq1wNjt-RU_MWfO_dU2bCiay5xoUVXE';
const CHAT_ID = '-5190606289';

const bqCredentials = process.env.GOOGLE_AUTH_JSON 
  ? JSON.parse(process.env.GOOGLE_AUTH_JSON)
  : undefined;

const bq = new BigQuery({
  projectId: PROJECT_ID,
  credentials: bqCredentials,
  keyFilename: !bqCredentials ? SERVICE_ACCOUNT_FILE : undefined
});

export async function POST(req: Request) {
    const data = await req.json();
    const { cid, url, lead_id_manual } = data;
    
    if (!cid) return NextResponse.json({ error: 'Missing CID' }, { status: 400 });

    try {
        
        // 1. Check if we already know this CID or if we have a new lead_id to link
        let [mappingRows] = await bq.query({
            query: `SELECT lead_id FROM \`${PROJECT_ID}.${DATASET_ID}.marketing_visitor_mapping\` WHERE foryou_cid = @cid LIMIT 1`,
            params: { cid }
        });

        const currentLeadId = lead_id_manual || (mappingRows[0]?.lead_id);

        if (currentLeadId) {
            // 2. Fetch Lead Name from amoCRM database (using existing history table)
            const [leadRows] = await bq.query({
                query: `SELECT name FROM \`${PROJECT_ID}.${DATASET_ID}.leads_all_history_full\` WHERE lead_id = @id LIMIT 1`,
                params: { id: parseInt(currentLeadId) }
            });

            const leadName = leadRows[0]?.name || `Lead #${currentLeadId}`;

            // 3. SEND ALERT TO TELEGRAM
            const message = `⚡️ *CLIENT ACTIVITY ALERT*\n\nName: *${leadName}* (ID: ${currentLeadId})\nPage: ${url.split('?')[0]}\n\n[Open in CRM](https://reforyou.amocrm.ru/leads/detail/${currentLeadId})`;
            
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    chat_id: CHAT_ID, 
                    text: message, 
                    parse_mode: 'Markdown' 
                })
            });

            // 4. Update/Create Mapping in BQ
            if (!mappingRows.length || lead_id_manual) {
                // Upsert logic (simple insertion for tracking log, or manual update)
                // For performance, we just insert tracking info
                await bq.query({
                    query: `
                        INSERT INTO \`${PROJECT_ID}.${DATASET_ID}.marketing_visitor_mapping\` (foryou_cid, lead_id, last_seen, last_page_url, first_seen)
                        VALUES (@cid, @lid, CURRENT_TIMESTAMP(), @url, CURRENT_TIMESTAMP())
                    `,
                    params: { cid, lid: parseInt(currentLeadId), url }
                });
            }
        }

        return NextResponse.json({ success: true, recognized: !!currentLeadId });
    } catch (e) {
        console.error('Tracking Failed:', e);
        return NextResponse.json({ error: 'Tracking Failed' }, { status: 500 });
    }
}
