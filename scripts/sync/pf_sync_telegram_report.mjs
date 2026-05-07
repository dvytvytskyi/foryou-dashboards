import 'dotenv/config';
import { Client } from 'pg';

const REPORT_WINDOW_MINUTES = Number(process.env.PF_SYNC_REPORT_WINDOW_MINUTES || 10);
const MAX_LINKS = Number(process.env.PF_SYNC_REPORT_MAX_LINKS || 40);
const REPORT_TZ = process.env.PF_SYNC_REPORT_TIMEZONE || 'Europe/Moscow';
const TELEGRAM_BOT_TOKEN = process.env.PF_SYNC_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.PF_SYNC_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '';
const AMO_DOMAIN = String(process.env.AMO_DOMAIN || 'reforyou.amocrm.ru')
  .replace(/^https?:\/\//i, '')
  .replace(/\/+$/g, '');

function getConnectionString() {
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;

  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DB;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const sslMode = (process.env.POSTGRES_SSL_MODE || 'require').toLowerCase();

  if (!host || !database || !user || !password) {
    throw new Error('Missing PostgreSQL env. Set POSTGRES_URL or POSTGRES_HOST/PORT/DB/USER/PASSWORD');
  }

  const sslPart = sslMode === 'disable' ? '' : '?sslmode=require';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}${sslPart}`;
}

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error('Missing PF_SYNC_TELEGRAM_BOT_TOKEN or PF_SYNC_TELEGRAM_CHAT_ID');
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(`Telegram send failed: ${JSON.stringify(data)}`);
  }
}

async function loadRecentSyncedRows(client) {
  const q = `
    SELECT
      pf_lead_id::text AS pf_lead_id,
      amo_lead_id::bigint AS amo_lead_id,
      synced_at,
      COALESCE(payload->>'createdAt', '') AS pf_created_at,
      COALESCE(payload->>'entityType', '') AS entity_type,
      COALESCE(payload->>'listingRef', '') AS listing_ref,
      COALESCE(payload->>'projectId', '') AS project_id,
      COALESCE(payload->>'channel', '') AS channel
    FROM pf_amo_sync_state
    WHERE synced_at >= NOW() - ($1::int * INTERVAL '1 minute')
    ORDER BY synced_at DESC
  `;
  const res = await client.query(q, [REPORT_WINDOW_MINUTES]);
  return res.rows;
}

function fmtTime(value) {
  if (!value) return '--:--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--:--';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: REPORT_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function buildReport(rows) {
  const now = new Date();
  const title = `<b>PF -> AMO report (${REPORT_WINDOW_MINUTES}m)</b>`;
  const summary = `Leads transferred: <b>${rows.length}</b>\nTime: ${escHtml(now.toISOString())}`;

  if (!rows.length) {
    return `${title}\n${summary}\n\nNo new leads in this window.`;
  }

  const links = rows.slice(0, MAX_LINKS).map((r) => {
    const amoLeadId = Number(r.amo_lead_id || 0);
    const amoLink = `https://${AMO_DOMAIN}/leads/detail/${amoLeadId}`;
    const pfLeadId = escHtml(r.pf_lead_id);
    const metaParts = [r.entity_type, r.channel].filter(Boolean).map((v) => escHtml(v));
    const meta = metaParts.length ? ` (${metaParts.join(', ')})` : '';
    const pfTime = fmtTime(r.pf_created_at);
    const syncTime = fmtTime(r.synced_at);
    return `• <a href=\"${amoLink}\">AMO #${amoLeadId}</a> ← ${pfLeadId}${meta} | PF ${pfTime} -> AMO ${syncTime}`;
  });

  const hidden = rows.length - links.length;
  const hiddenLine = hidden > 0 ? `\n... and ${hidden} more` : '';

  return `${title}\n${summary}\n\n${links.join('\n')}${hiddenLine}`;
}

async function main() {
  const connectionString = getConnectionString();
  const sslMode = (process.env.POSTGRES_SSL_MODE || 'require').toLowerCase();

  const client = new Client({
    connectionString,
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const rows = await loadRecentSyncedRows(client);
    const report = buildReport(rows);
    await sendTelegramMessage(report);
    console.log(JSON.stringify({ success: true, windowMinutes: REPORT_WINDOW_MINUTES, transferred: rows.length }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[PF->AMO REPORT] Fatal:', err?.message || err);
  process.exit(1);
});
