import { NextRequest, NextResponse } from 'next/server';
import { queryPostgres } from '@/lib/postgres';

const AMO_DOMAIN = process.env.AMO_DOMAIN!;
const CLIENT_ID = process.env.AMO_CLIENT_ID!;
const CLIENT_SECRET = process.env.AMO_CLIENT_SECRET!;
const REDIRECT_URI = 'https://dashboards.foryou-realestate.com/api/amo/oauth-callback';

async function saveTokensToDB(tokens: Record<string, unknown>) {
  await queryPostgres(
    `INSERT INTO integration_tokens(provider, tokens, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (provider) DO UPDATE SET tokens = $2, updated_at = NOW()`,
    ['amo', JSON.stringify(tokens)]
  );
}

async function updateGitHubSecret(tokens: Record<string, unknown>) {
  const ghToken = process.env.GH_TOKEN;
  if (!ghToken) return { ok: false, reason: 'GH_TOKEN not set' };

  const repoRes = await fetch('https://api.github.com/repos/dvytvytskyi/foryou-dashboards/actions/secrets/public-key', {
    headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' },
  });
  if (!repoRes.ok) return { ok: false, reason: `public-key fetch failed: ${repoRes.status}` };
  const { key_id, key: publicKey } = await repoRes.json();

  // Encrypt secret using libsodium (tweetnacl polyfill via TextEncoder)
  const sodium = await import('libsodium-wrappers');
  await sodium.ready;
  const keyBytes = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
  const msgBytes = new TextEncoder().encode(JSON.stringify(tokens));
  const encrypted = sodium.crypto_box_seal(msgBytes, keyBytes);
  const encryptedB64 = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL);

  const putRes = await fetch('https://api.github.com/repos/dvytvytskyi/foryou-dashboards/actions/secrets/AMO_TOKENS_JSON', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ encrypted_value: encryptedB64, key_id }),
  });
  return { ok: putRes.ok, status: putRes.status };
}

async function sendTelegramAlert(message: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  }).catch(() => {});
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  const res = await fetch(`https://${AMO_DOMAIN}/oauth2/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return new NextResponse(
      `<html><body style="font-family:monospace;padding:20px">
        <h2 style="color:red">❌ Token exchange failed</h2>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  const tokens = { ...data, server_time: Math.floor(Date.now() / 1000) };

  // 1. Save to DB
  let dbOk = false;
  try {
    await saveTokensToDB(tokens);
    dbOk = true;
  } catch (e) {
    console.error('[AMO OAuth] DB save failed:', e);
  }

  // 2. Update GitHub Secret (best-effort, requires libsodium)
  let ghResult: { ok: boolean; reason?: string; status?: number } = { ok: false, reason: 'skipped' };
  try {
    ghResult = await updateGitHubSecret(tokens);
  } catch (e) {
    ghResult = { ok: false, reason: String(e) };
  }

  // 3. Telegram notification
  await sendTelegramAlert(
    `✅ <b>AMO реавторизовано</b>\nDB: ${dbOk ? '✅' : '❌'}\nGitHub Secret: ${ghResult.ok ? '✅' : '⚠️ ' + (ghResult.reason ?? ghResult.status)}\n\nТокен активний.`
  );

  return new NextResponse(
    `<html><body style="font-family:monospace;padding:20px;max-width:600px">
      <h2 style="color:green">✅ AMO успішно підключено!</h2>
      <ul>
        <li>DB (integration_tokens): ${dbOk ? '✅ збережено' : '❌ помилка'}</li>
        <li>GitHub Secret: ${ghResult.ok ? '✅ оновлено' : '⚠️ ' + (ghResult.reason ?? ghResult.status) + ' — оновіть вручну'}</li>
      </ul>
      ${!ghResult.ok ? `<details><summary>Токен для ручного копіювання</summary><textarea rows="8" style="width:100%;font-size:11px">${JSON.stringify(tokens)}</textarea></details>` : ''}
      <p style="color:gray;font-size:12px">Expires: ${new Date((tokens.server_time + (tokens.expires_in ?? 86400)) * 1000).toISOString()}</p>
      <p><a href="/settings/integrations">← Повернутись</a></p>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}
