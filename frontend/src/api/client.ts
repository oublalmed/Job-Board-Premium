'use client';

import createClient from 'openapi-fetch';
import type { paths } from './schema';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!baseUrl) {
  throw new Error(
    'NEXT_PUBLIC_API_BASE_URL is not set — copy .env.example to .env.local',
  );
}

export const apiClient = createClient<paths>({ baseUrl });
