import { NextRequest, NextResponse } from 'next/server';

const AMO_DOMAIN = process.env.AMO_DOMAIN!;
const CLIENT_ID = process.env.AMO_CLIENT_ID!;
const CLIENT_SECRET = process.env.AMO_CLIENT_SECRET!;
const REDIRECT_URI = 'https://dashboards.foryou-realestate.com/api/amo/oauth-callback';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  const body = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
  };

  const res = await fetch(`https://${AMO_DOMAIN}/oauth2/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: 'Token exchange failed', details: data }, { status: 400 });
  }

  // Return tokens as JSON so user can copy them into GitHub Secret
  return new NextResponse(
    `<html><body style="font-family:monospace;padding:20px">
      <h2 style="color:green">✅ Tokens received!</h2>
      <p>Copy the JSON below and paste it into GitHub Secret <b>AMO_TOKENS_JSON</b>:</p>
      <textarea rows="10" style="width:100%;font-size:12px">${JSON.stringify(data)}</textarea>
      <p style="color:gray">server_time: ${data.server_time} (${new Date(data.server_time * 1000).toISOString()})</p>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}
