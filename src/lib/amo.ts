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
  }

  const fileJson = fs.readFileSync(TOKENS_PATH, 'utf8');
  const parsedFile = parseJson(fileJson);
  if (!parsedFile || typeof parsedFile !== 'object') {
    throw new Error('Invalid AmoCRM token payload in secrets/amo_tokens.json');
  }

  return { tokens: parsedFile, fromEnv: false };
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
    return null;
  }

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
    return null;
  }

  const refreshed = await res.json();
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
  if (res.status !== 401) return res;

  const refreshed = await refreshAmoTokens(tokens, fromEnv);
  if (!refreshed?.access_token) return res;

  res = await doFetch(refreshed.access_token);
  return res;
}
