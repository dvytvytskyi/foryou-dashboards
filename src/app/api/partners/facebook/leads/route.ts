import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
const TOKENS_PATH = path.join(process.cwd(), 'secrets/amo_tokens.json');

function getDomain() {
  return process.env.AMO_DOMAIN || 'reforyou.amocrm.ru';
}

function readTokens() {
  if (process.env.AMO_TOKENS_JSON) {
    return { tokens: JSON.parse(process.env.AMO_TOKENS_JSON), fromEnv: true };
  }
  return { tokens: JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8')), fromEnv: false };
}

function writeTokensIfFile(tokens: any, fromEnv: boolean) {
  if (fromEnv) return;
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

async function refreshAccessToken(currentTokens: any, fromEnv: boolean) {
  const clientId = process.env.AMO_CLIENT_ID;
  const clientSecret = process.env.AMO_CLIENT_SECRET;
  const redirectUri = process.env.AMO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri || !currentTokens?.refresh_token) {
    throw new Error('AmoCRM token expired and refresh env vars are missing');
  }

  const res = await fetch(`https://${getDomain()}/oauth2/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: currentTokens.refresh_token,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to refresh AmoCRM token: ${err}`);
  }

  const refreshed = await res.json();
  const merged = { ...currentTokens, ...refreshed };
  writeTokensIfFile(merged, fromEnv);
  return merged;
}

async function amoFetch(pathname: string, init?: RequestInit) {
  const { tokens, fromEnv } = readTokens();
  const doFetch = (accessToken: string) =>
    fetch(`https://${getDomain()}${pathname}`, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: 'Bearer ' + accessToken,
      },
    });

  let res = await doFetch(tokens.access_token);
  if (res.status !== 401) return res;

  const refreshed = await refreshAccessToken(tokens, fromEnv);
  res = await doFetch(refreshed.access_token);
  return res;
}

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
