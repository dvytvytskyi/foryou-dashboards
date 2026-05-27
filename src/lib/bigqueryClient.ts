import { createBigQueryClient } from '@/lib/googleAuth';

const PROXY_URL = process.env.BIGQUERY_PROXY_URL?.trim();
const PROXY_SECRET = process.env.BIGQUERY_PROXY_SECRET?.trim();

export type BigQueryQueryOptions = {
  projectId?: string;
  query: string;
  params?: Record<string, unknown>;
  useLegacySql?: boolean;
};

export async function bigQueryQuery(options: BigQueryQueryOptions) {
  const projectId = options.projectId || process.env.BIGQUERY_PROJECT_ID || 'crypto-world-epta';

  if (PROXY_URL) {
    return queryRemoteBigQuery({ projectId, query: options.query, params: options.params, useLegacySql: options.useLegacySql });
  }

  const client = createBigQueryClient(projectId);
  const [rows] = await client.query({
    query: options.query,
    params: options.params,
    useLegacySql: options.useLegacySql,
  });

  return rows;
}

async function queryRemoteBigQuery(options: BigQueryQueryOptions) {
  const response = await fetch(PROXY_URL!, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(PROXY_SECRET ? { 'x-bq-proxy-secret': PROXY_SECRET } : {}),
    },
    body: JSON.stringify({
      projectId: options.projectId,
      query: options.query,
      params: options.params,
      useLegacySql: options.useLegacySql,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    let bodyText = text;
    try {
      const json = JSON.parse(text);
      bodyText = json?.error ?? JSON.stringify(json);
    } catch {
      // leave raw text
    }
    throw new Error(`BigQuery proxy failed ${response.status}: ${bodyText}`);
  }

  const json = JSON.parse(text);
  if (!json?.success) {
    throw new Error(json?.error || 'BigQuery proxy returned failure');
  }

  return json.rows;
}
