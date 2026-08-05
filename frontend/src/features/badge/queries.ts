'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';
import type { BadgeStatus, PublicBadge } from './types';

// EF-GROW-01 (Lot 7). These endpoints post-date the last OpenAPI schema
// generation, so — like the CV/diploma uploads — they use fetch directly
// with a bearer token rather than the generated openapi-fetch client.
// Regenerate with `npm run generate:api` against a live backend to fold
// them into the typed client.
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

export const badgeKeys = {
  all: ['score-badge'] as const,
  mine: () => [...badgeKeys.all, 'mine'] as const,
  public: (token: string) => ['public-badge', token] as const,
};

export function useScoreBadge() {
  return useQuery({
    queryKey: badgeKeys.mine(),
    queryFn: () => authedJson<BadgeStatus>('/api/v1/candidates/score-badge'),
  });
}

export function useEnableBadge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (displayName?: string) =>
      authedJson<BadgeStatus>('/api/v1/candidates/score-badge', {
        method: 'POST',
        body: JSON.stringify({ displayName: displayName?.trim() || undefined }),
      }),
    onSuccess: (data) => queryClient.setQueryData(badgeKeys.mine(), data),
  });
}

export function useDisableBadge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      authedJson<BadgeStatus>('/api/v1/candidates/score-badge', {
        method: 'DELETE',
      }),
    onSuccess: (data) => queryClient.setQueryData(badgeKeys.mine(), data),
  });
}

// Public — no auth. 404 (unknown/disabled/opted-out token) resolves to null
// so the page can render its own "not found" state instead of erroring.
export function usePublicBadge(token: string) {
  return useQuery({
    queryKey: badgeKeys.public(token),
    enabled: !!token,
    retry: false,
    queryFn: async (): Promise<PublicBadge | null> => {
      const res = await fetch(`${BASE}/api/v1/badges/${token}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as PublicBadge;
    },
  });
}
