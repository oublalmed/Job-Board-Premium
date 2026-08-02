// JWT storage — the choice here is a real XSS tradeoff, not a default,
// see the full write-up in README.md ("Auth / JWT storage"). Summary:
//
// - Access token: module-level variable only. Never touches
//   localStorage/sessionStorage/IndexedDB — there is no persistent,
//   JS-readable-at-rest copy of the highest-value, most-frequently-used
//   credential for an XSS payload to go looking for after the fact.
//   Cost: lost on every full page reload, recovered via a silent
//   refresh (see api-middleware.ts) as long as a refresh token survives.
// - Refresh token: sessionStorage, not localStorage. This backend
//   returns tokens in the JSON response body, not an httpOnly cookie
//   (confirmed by reading auth.controller.ts before choosing) — httpOnly
//   cookies are the only storage truly immune to JS-based exfiltration,
//   and that option isn't available without a backend change out of
//   scope for Front 0. Given that constraint, sessionStorage is a
//   deliberate middle ground: same XSS exposure as localStorage in
//   principle (both are plain JS-readable Web Storage — sessionStorage
//   is not "safe against XSS", nothing client-side-only is), but a much
//   smaller blast radius in practice — cleared when the tab closes,
//   never silently outlives the browsing session the way a localStorage
//   token would (indefinitely, until its own 7-day expiry). The actual
//   defense against token theft is preventing XSS in the first place
//   (React's default JSX escaping, no dangerouslySetInnerHTML with
//   unsanitized input) — storage choice only bounds the damage if that
//   fails, it doesn't prevent it.
const REFRESH_TOKEN_STORAGE_KEY = 'jbp_refresh_token';

let accessToken: string | null = null;
let accessTokenExpiresAt = 0; // epoch ms, 0 = unknown/absent

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

// Reads the JWT's own `exp` claim to know when to refresh — no signature
// verification (the browser has no way to verify it anyway, and doesn't
// need to: the backend re-validates on every real request regardless,
// this is purely a client-side "is it worth sending" optimization).
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
