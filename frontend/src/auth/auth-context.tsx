import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiClient } from '@/api/client';
import type { components } from '@/api/schema';
import { onSessionExpired } from './auth-events';
import {
  clearAllTokens,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './token-store';

export type AuthUser = components['schemas']['MeResponseDto'];
export type Role = AuthUser['roles'][number];

interface AuthContextValue {
  user: AuthUser | null;
  // True only while the initial silent-restore attempt (on app boot) is
  // in flight — guards do not redirect on a false negative during this
  // window (a refresh in progress looks like "not logged in" otherwise).
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrateUser = useCallback(async (): Promise<boolean> => {
    const { data, error } = await apiClient.GET('/api/v1/auth/me');
    if (error || !data) {
      setUser(null);
      return false;
    }
    setUser(data);
    return true;
  }, []);

  useEffect(() => {
    const unsubscribe = onSessionExpired(() => setUser(null));

    // Silent restore on boot: the access token never survives a reload
    // (in-memory only, see token-store.ts), but the refresh token might
    // (sessionStorage) — if so, mint a fresh access token and hydrate the
    // user before rendering anything that depends on auth state.
    void (async () => {
      if (getRefreshToken()) {
        await hydrateUser();
      }
      setIsLoading(false);
    })();

    return unsubscribe;
  }, [hydrateUser]);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const { data, error } = await apiClient.POST('/api/v1/auth/login', {
        body: { email, password },
      });
      // Deliberately not surfacing the backend's own error message here:
      // it's plain, untranslated English (auth.service.ts throws
      // UnauthorizedException('Invalid credentials') literally) — showing
      // it verbatim in an Arabic or French UI would contradict "aucune
      // string en dur, même le FR". LoginPage maps this failure to a
      // translated message instead.
      if (error || !data) {
        throw new AuthError();
      }
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      const hydrated = await hydrateUser();
      if (!hydrated) {
        clearAllTokens();
        throw new AuthError();
      }
    },
    [hydrateUser],
  );

  const logout = useCallback(() => {
    clearAllTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() must be used within an <AuthProvider>');
  }
  return context;
}

// Deliberately carries no message of its own — LoginPage/RegisterPage
// catch this and render a translated string via t(), never anything
// read off the error object itself.
export class AuthError extends Error {}
