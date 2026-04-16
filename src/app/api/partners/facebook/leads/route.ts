import { NextResponse } from 'next/server';
import { amoFetch } from '@/lib/amo';

type AmoLead = {
  id: number;
  name: string;
  price: number;
  status_id: number;
  created_at: number;
  responsible_user_id: number;
  _embedded?: {
    tags?: Array<{ name?: string }>;
  };
};

const RE_PIPELINE_ID = '8696950';

function isFacebookOmanLead(lead: AmoLead) {
  const tags = (lead._embedded?.tags || []).map((t) => (t.name || '').toLowerCase());
  return tags.includes('oman');
}

export async function GET() {
  try {
    const limit = 250;
    let page = 1;
    let hasMore = true;
    const allLeads: AmoLead[] = [];

    // Use query=Oman for efficient server-side filtering (much faster than fetching all leads)
    while (hasMore) {
      const url =
        `/api/v4/leads?filter[pipeline_id]=${RE_PIPELINE_ID}` +
        `&query=Oman` +
        `&limit=${limit}&page=${page}&with=contacts,tags`;

      const res = await amoFetch(url);
      if (res.status === 204) break;
      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ success: false, error: err }, { status: res.status });
      }

      const json = await res.json();
      const leadsPage: AmoLead[] = json._embedded?.leads || [];
      if (!leadsPage.length) break;

      allLeads.push(...leadsPage);
      hasMore = leadsPage.length === limit;
      page += 1;
    }

    const filtered = allLeads.filter(isFacebookOmanLead);

    const mapped = filtered.map((l) => {
        const tags = (l._embedded?.tags || []).map((t) => t.name || '').filter(Boolean);
        // If query found it, but tags in response are empty, it might still be a valid Oman lead
        if (tags.length === 0) tags.push('Oman');
        
        return {
            id: l.id,
            name: l.name,
            price: l.price,
            status_id: l.status_id,
            created_at: l.created_at,
            responsible_user_id: l.responsible_user_id,
            tags: tags,
        };
    });

    // Fetch pipeline statuses for dynamic columns
    const pipelineRes = await amoFetch(`/api/v4/leads/pipelines/${RE_PIPELINE_ID}`);
    let funnels: Array<{ id: number; name: string }> = [];
    if (pipelineRes.ok) {
      const pipeline = await pipelineRes.json();
      const statuses = pipeline?._embedded?.statuses || [];
      funnels = statuses
        .map((s: any) => ({ id: Number(s.id), name: String(s.name || '') }))
        .filter((s: any) => Number.isFinite(s.id) && s.name && s.id !== 143); // Exclude "Closed" if needed
    }

    return NextResponse.json({
      success: true,
      data: mapped,
      funnels
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
