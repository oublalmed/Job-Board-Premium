const REFRESH_TOKEN_STORAGE_KEY = 'jbp_refresh_token';

let accessToken: string | null = null;
let accessTokenExpiresAt = 0;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getAccessTokenExpiresAt(): number {
  return accessTokenExpiresAt;
}

export function setAccessToken(token: string): void {
  accessToken = token;
  accessTokenExpiresAt = decodeJwtExpiryMs(token);
}

export function clearAccessToken(): void {
  accessToken = null;
  accessTokenExpiresAt = 0;
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
}

export function setRefreshToken(token: string): void {
  sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
}

export function clearRefreshToken(): void {
  sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

export function clearAllTokens(): void {
  clearAccessToken();
  clearRefreshToken();
}

function decodeJwtExpiryMs(token: string): number {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) return 0;
    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized)) as { exp?: number };
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : 0;
  } catch {
    return 0;
  }
}
