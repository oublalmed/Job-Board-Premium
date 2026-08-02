import createClient from 'openapi-fetch';
import type { paths } from './schema';

// Types come exclusively from schema.d.ts (generated — see
// `npm run generate:api`, README). Never hand-written: a request/response
// shape here is only ever as current as the last regeneration against the
// real backend contract.
//
// baseUrl is the bare origin, NOT including /api/v1 — the schema's own
// path keys already carry the full registered route (NestJS's global
// prefix is set before the Swagger document is built), so every call site
// uses the full path, e.g. apiClient.POST('/api/v1/auth/login', ...).
const baseUrl = import.meta.env.VITE_API_BASE_URL;
if (!baseUrl) {
  throw new Error(
    'VITE_API_BASE_URL is not set — copy .env.example to .env.local',
  );
}

// The auth commit attaches a request/response middleware here (Bearer
// token, refresh-on-401) via apiClient.use({ onRequest, onResponse }) —
// openapi-fetch's own extension point, not a second HTTP layer wrapped
// around it.
export const apiClient = createClient<paths>({ baseUrl });
