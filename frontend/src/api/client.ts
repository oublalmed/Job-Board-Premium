'use client';

import createClient from 'openapi-fetch';
import type { paths } from './schema';

// An empty string is a valid, deliberate value: it makes every request
// same-origin/relative (e.g. behind a reverse proxy that routes /api/* to the
// API — see docs/DEMO-DEPLOY.md). Only a truly-unset var is a misconfiguration.
const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
if (baseUrl === undefined) {
  throw new Error(
    'NEXT_PUBLIC_API_BASE_URL is not set — copy .env.example to .env.local ' +
      '(use an empty string for a same-origin / reverse-proxy deployment)',
  );
}

export const apiClient = createClient<paths>({ baseUrl });
