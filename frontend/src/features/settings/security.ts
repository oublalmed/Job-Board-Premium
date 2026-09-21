'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';

// EF-CAND-01 / ENF-06 — self-service security: change password and manage
// two-factor authentication. These endpoints exist in the API but post-date
// the last OpenAPI generation, so they use fetch + bearer.
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function authedJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${getAccessToken()}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

export interface MfaStatus {
  mfaEnabled: boolean;
}

export interface MfaSetup {
  secret: string;
  otpauthUri: string;
}

export const securityKeys = {
  status: ['auth', 'security-status'] as const,
};

export function useMfaStatus() {
  return useQuery({
    queryKey: securityKeys.status,
    queryFn: () => authedJson<MfaStatus>('/api/v1/auth/me'),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      authedJson<{ message: string }>('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function useMfaSetup() {
  return useMutation({
    mutationFn: () =>
      authedJson<MfaSetup>('/api/v1/auth/mfa/setup', { method: 'POST' }),
  });
}

export function useMfaEnable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string }) =>
      authedJson<{ backupCodes: string[] }>('/api/v1/auth/mfa/enable', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: securityKeys.status });
    },
  });
}

export function useMfaDisable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string }) =>
      authedJson<{ message: string }>('/api/v1/auth/mfa/disable', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: securityKeys.status });
    },
  });
}
