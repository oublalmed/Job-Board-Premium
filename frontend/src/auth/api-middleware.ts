'use client';

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

const REFRESH_BUFFER_MS = 10_000;

const SKIP_AUTH_SCHEMA_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/verify-email',
]);

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
    if (response.status === 401 && !SKIP_AUTH_SCHEMA_PATHS.has(schemaPath)) {
      clearAllTokens();
      notifySessionExpired();
    }
    return response;
  },
});
