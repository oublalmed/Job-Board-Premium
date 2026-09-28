'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function authed<T>(path: string, init?: RequestInit): Promise<T> {
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

export type SuspicionLevel = 'low' | 'medium' | 'high';

export interface CandidateIntegrity {
  antiCheatEnabled: boolean;
  assessmentsCount: number;
  tabSwitchCount: number;
  windowBlurCount: number;
  proctoringFlagged: boolean;
  multiAccountFlagged: boolean;
  suspiciousEvents: number;
  level: SuspicionLevel;
}

export function useCandidateIntegrity(
  candidateProfileId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['anti-cheat', 'candidate', candidateProfileId],
    enabled: enabled && !!candidateProfileId,
    queryFn: () =>
      authed<CandidateIntegrity>(
        `/api/v1/anti-cheat/candidates/${candidateProfileId}`,
      ),
  });
}

export function useAntiCheatSetting(enabled: boolean) {
  return useQuery({
    queryKey: ['anti-cheat', 'setting'],
    enabled,
    queryFn: () => authed<{ enabled: boolean }>('/api/v1/anti-cheat/setting'),
  });
}

export function useSetAntiCheatSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: boolean) =>
      authed<{ enabled: boolean }>('/api/v1/anti-cheat/setting', {
        method: 'PATCH',
        body: JSON.stringify({ enabled: value }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['anti-cheat', 'setting'] });
    },
  });
}
