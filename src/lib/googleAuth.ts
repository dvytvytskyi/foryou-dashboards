import { BigQuery } from '@google-cloud/bigquery';
import fs from 'fs';
import path from 'path';

const SERVICE_ACCOUNT_FILE = path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json');
const SERVICE_ACCOUNT_FILE_IN_CONTAINER = '/app/secrets/crypto-world-epta-2db29829d55d.json';

type GoogleCredentials = {
  client_email?: string;
  private_key?: string;
  [key: string]: unknown;
};

function normalizeCredentials(value: unknown): GoogleCredentials | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const credentials = value as GoogleCredentials;
  if (typeof credentials.private_key === 'string') {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  return credentials;
}

export function readGoogleCredentials() {
  const raw = process.env.GOOGLE_AUTH_JSON;
  if (!raw) return undefined;

  try {
    return normalizeCredentials(JSON.parse(raw));
  } catch {
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      return normalizeCredentials(JSON.parse(decoded));
    } catch {
      return undefined;
    }
  }
}

function resolveServiceAccountPath() {
  const configured = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const candidates = [configured, SERVICE_ACCOUNT_FILE, SERVICE_ACCOUNT_FILE_IN_CONTAINER].filter(Boolean) as string[];
  return candidates.find((filePath) => fs.existsSync(filePath));
}

export function createBigQueryClient(projectId: string) {
  const keyFilename = resolveServiceAccountPath();
  const credentials = keyFilename ? undefined : readGoogleCredentials();

  return new BigQuery({
    projectId,
    credentials,
    keyFilename,
  });
}