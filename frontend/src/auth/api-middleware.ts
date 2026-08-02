import { apiClient } from '@/api/client';
import { notifySessionExpired } from './auth-events';
import {
  clearAllTokens,
  getAccessToken,
  getAccessTokenExpiresAt,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './token-store';

// Refresh a bit before actual expiry, not exactly at it — avoids a request
// racing the token's last valid millisecond and landing as a 401 anyway.
const REFRESH_BUFFER_MS = 10_000;

// These must never get an Authorization header attached (there's nothing
// valid to attach before login) or trigger a refresh attempt themselves —
// /auth/refresh calling into "ensure a fresh token, refreshing via
// /auth/refresh if needed" would recurse. Keyed by the OpenAPI schema path
// (e.g. "/api/v1/auth/login"), not the interpolated request URL.
const SKIP_AUTH_SCHEMA_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/verify-email',
]);

// Concurrent requests firing right as the token expires must share one
// refresh attempt, not each fire their own — this is the de-dupe.
let refreshPromise: Promise<string | null> | null = null;

async function ensureFreshAccessToken(): Promise<string | null> {
  const token = getAccessToken();
  const expiresAt = getAccessTokenExpiresAt();
  const needsRefresh = !token || Date.now() >= expiresAt - REFRESH_BUFFER_MS;
  if (!needsRefresh) {
    return token;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  refreshPromise ??= performRefresh(refreshToken).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function performRefresh(refreshToken: string): Promise<string | null> {
  const { data, error } = await apiClient.POST('/api/v1/auth/refresh', {
    body: { refreshToken },
  });
  if (error || !data) {
    clearAllTokens();
    notifySessionExpired();
    return null;
  }
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  return data.accessToken;
}

// Installed once at app startup (imported for its side effect from
// main.tsx, same pattern as src/i18n/index.ts) — every request through
// apiClient goes through this, there is no second, separately-configured
// HTTP client anywhere else that could accidentally skip it.
apiClient.use({
  async onRequest({ request, schemaPath }) {
    if (SKIP_AUTH_SCHEMA_PATHS.has(schemaPath)) {
      return request;
    }

    const token = await ensureFreshAccessToken();
    if (!token) {
      return request;
    }

    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return new Request(request, { headers });
  },

  onResponse({ response, schemaPath }) {
    // The proactive refresh above already had its chance — a 401 here
    // (on anything other than the bootstrap endpoints themselves) means
    // the session is genuinely over: revoked server-side, or the refresh
    // token expired mid-request. No retry, just log out; RequireAuth
    // reacts to the resulting user:null and redirects.
    if (response.status === 401 && !SKIP_AUTH_SCHEMA_PATHS.has(schemaPath)) {
      clearAllTokens();
      notifySessionExpired();
    }
    return response;
  },
});
