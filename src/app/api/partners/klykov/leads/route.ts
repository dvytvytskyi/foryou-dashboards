
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { amoFetch } from '@/lib/amo';

const CACHE_PATH = path.resolve(process.cwd(), 'data/cache/partners/klykov_leads.json');

async function readCache() {
  try {
    return JSON.parse(await fs.readFile(CACHE_PATH, 'utf8')) as { data: any[]; cachedAt: string };
  } catch {
    return null;
  }
}

async function writeCache(data: any[]) {
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await fs.writeFile(
    CACHE_PATH,
    JSON.stringify({ data, cachedAt: new Date().toISOString() }),
    'utf8',
  );
}

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
        const cached = await readCache();
        if (cached?.data?.length) {
          return NextResponse.json({ success: true, stale: true, cachedAt: cached.cachedAt, data: cached.data });
        }
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

    await writeCache(mapped);

    return NextResponse.json({ success: true, data: mapped });
  } catch (e: any) {
    console.error('[Partners/Klykov/Leads] Exception:', e.message);
    const cached = await readCache();
    if (cached?.data?.length) {
      return NextResponse.json({ success: true, stale: true, cachedAt: cached.cachedAt, data: cached.data });
    }
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
