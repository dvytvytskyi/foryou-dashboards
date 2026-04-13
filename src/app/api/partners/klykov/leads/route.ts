
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const pipelineId = '10776450';
    const tokensPath = path.join(process.cwd(), 'secrets/amo_tokens.json');
    let tokens;
    if (process.env.AMO_TOKENS_JSON) {
        tokens = JSON.parse(process.env.AMO_TOKENS_JSON);
    } else {
        tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    }

    const baseUrl = 'https://reforyou.amocrm.ru/api/v4/leads';
    const query = '?filter[pipeline_id]=' + pipelineId + '&limit=250&with=contacts';
    const fullUrl = baseUrl + query;

    const res = await fetch(fullUrl, {
      headers: { 
        'Authorization': 'Bearer ' + tokens.access_token 
      }
    });

    if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ success: false, error: err }, { status: res.status });
    }

    const json = await res.json();
    const leads = json._embedded?.leads || [];

    const mapped = leads.map((l: any) => ({
        id: l.id,
        name: l.name,
        price: l.price,
        status_id: l.status_id,
        created_at: l.created_at,
        responsible_user_id: l.responsible_user_id,
        tags: l._embedded?.tags?.map((t: any) => t.name) || []
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
