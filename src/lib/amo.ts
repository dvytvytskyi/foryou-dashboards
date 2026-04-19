import fs from 'fs';
import path from 'path';

const TOKENS_PATH = path.join(process.cwd(), 'secrets/amo_tokens.json');

type AmoTokens = {
  access_token?: string;
  refresh_token?: string;
  [key: string]: unknown;
};

function parseJson(value: string): any | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function getAmoDomain(): string {
  const raw = process.env.AMO_DOMAIN || 'reforyou.amocrm.ru';
  return raw.replace(/^https?:\/\//i, '').replace(/\/+$/g, '');
}

export function readAmoTokens(): { tokens: AmoTokens; fromEnv: boolean } {
  const envJson = process.env.AMO_TOKENS_JSON;
  if (envJson) {
    const parsed = parseJson(envJson);
    if (parsed && typeof parsed === 'object') {
      return { tokens: parsed, fromEnv: true };
    }
    console.error('[AMO] Invalid AMO_TOKENS_JSON in environment');
  }

  try {
    const fileJson = fs.readFileSync(TOKENS_PATH, 'utf8');
    const parsedFile = parseJson(fileJson);
    if (!parsedFile || typeof parsedFile !== 'object') {
      throw new Error('Invalid JSON structure in secrets/amo_tokens.json');
    }
    if (!parsedFile.access_token) {
      console.warn('[AMO] Warning: access_token missing in file tokens');
    }
    return { tokens: parsedFile, fromEnv: false };
  } catch (err: any) {
    throw new Error(`[AMO] Failed to read tokens: ${err.message}. Path: ${TOKENS_PATH}`);
  }
}

function persistTokensIfFile(tokens: AmoTokens, fromEnv: boolean) {
  if (fromEnv) return;
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

async function refreshAmoTokens(currentTokens: AmoTokens, fromEnv: boolean): Promise<AmoTokens | null> {
  const clientId = process.env.AMO_CLIENT_ID;
  const clientSecret = process.env.AMO_CLIENT_SECRET;
  const redirectUri = process.env.AMO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri || !currentTokens.refresh_token) {
    console.error('[AMO] Missing refresh credentials:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRedirectUri: !!redirectUri,
      hasRefreshToken: !!currentTokens.refresh_token,
    });
    return null;
  }

  console.log('[AMO] Attempting token refresh...');

  const res = await fetch(`https://${getAmoDomain()}/oauth2/access_token`, {
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
    const errText = await res.text();
    console.error('[AMO] Token refresh failed:', { status: res.status, error: errText });
    return null;
  }

  const refreshed = await res.json();
  console.log('[AMO] Token refreshed successfully');
  const merged = { ...currentTokens, ...refreshed };
  persistTokensIfFile(merged, fromEnv);
  return merged;
}

export async function amoFetch(pathname: string, init?: RequestInit): Promise<Response> {
  const { tokens, fromEnv } = readAmoTokens();

  const doFetch = (accessToken?: string) =>
    fetch(`https://${getAmoDomain()}${pathname}`, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${accessToken || ''}`,
      },
    });

  let res = await doFetch(tokens.access_token);
  
  if (res.status !== 401) {
    if (!res.ok) {
      console.warn(`[AMO] Non-401 error on ${pathname}: ${res.status}`);
    }
    return res;
  }

  console.warn(`[AMO] Got 401 on ${pathname}, attempting token refresh...`);
  const refreshed = await refreshAmoTokens(tokens, fromEnv);
  
  if (!refreshed?.access_token) {
    console.error('[AMO] Token refresh failed, returning 401 response');
    return res;
  }

  console.log('[AMO] Retrying request with refreshed token');
  res = await doFetch(refreshed.access_token);
  return res;
}
