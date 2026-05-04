import { NextResponse } from 'next/server';
import { amoFetch, getValidAmoTokens } from '@/lib/amo';

function parseTokenExpirySeconds(accessToken?: string): number | null {
  if (!accessToken) return null;
  const parts = accessToken.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const tokens = await getValidAmoTokens();
    const exp = parseTokenExpirySeconds(tokens.access_token);
    const secondsToExpiry = exp ? exp - nowSec : null;

    const probe = await amoFetch('/api/v4/account');
    const healthy = probe.ok;

    return NextResponse.json({
      success: true,
      healthy,
      probeStatus: probe.status,
      secondsToExpiry,
      isExpiringSoon: secondsToExpiry !== null ? secondsToExpiry <= 1800 : null,
      checkedAt: new Date().toISOString(),
    }, {
      status: healthy ? 200 : 503,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      healthy: false,
      error: error?.message || 'Unknown AMO health error',
      checkedAt: new Date().toISOString(),
    }, { status: 503 });
  }
}
