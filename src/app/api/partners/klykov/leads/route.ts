
import { NextResponse } from 'next/server';
import { amoFetch } from '@/lib/amo';

export async function GET() {
  try {
    const pipelineId = '10776450';
    const query = `/api/v4/leads?filter[pipeline_id]=${pipelineId}&limit=250&with=contacts`;
    
    console.log('[Partners/Klykov/Leads] Fetching from AMO pipeline:', pipelineId);
    const res = await amoFetch(query);

    if (!res.ok) {
        const err = await res.text();
        console.error('[Partners/Klykov/Leads] AMO returned error:', {
          status: res.status,
          statusText: res.statusText,
          errorLength: err.length,
        });
        return NextResponse.json({ success: false, error: err }, { status: res.status });
    }

    const json = await res.json();
    const leads = json._embedded?.leads || [];
    
    console.log('[Partners/Klykov/Leads] Successfully fetched', leads.length, 'leads');

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
    console.error('[Partners/Klykov/Leads] Exception:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
