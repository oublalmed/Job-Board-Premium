'use client';

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
    <AuthContext value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() must be used within an <AuthProvider>');
  }
  return context;
}

export class AuthError extends Error {}
