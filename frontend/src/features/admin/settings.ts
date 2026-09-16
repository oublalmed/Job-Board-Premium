'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';

// EF-ADM-02 admin settings endpoints post-date the last OpenAPI generation,
// so they use fetch + bearer (regenerate with `npm run generate:api`).
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

export interface Setting {
  key: string;
  value: string;
  description: string | null;
  valueType: string;
  updatedAt: string;
}

export const settingsKeys = {
  all: ['admin', 'settings'] as const,
};

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: () => authedJson<Setting[]>('/api/v1/admin/settings'),
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { key: string; value: string }) =>
      authedJson<Setting>(
        `/api/v1/admin/settings/${encodeURIComponent(input.key)}`,
        { method: 'PUT', body: JSON.stringify({ value: input.value }) },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}
