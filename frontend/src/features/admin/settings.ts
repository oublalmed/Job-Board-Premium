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

// EF-ADM-02 — one version-history entry for a setting key.
export interface SettingHistoryEntry {
  id: string;
  key: string;
  value: string;
  description: string | null;
  valueType: string;
  changedById: string | null;
  createdAt: string;
}

export const settingsKeys = {
  all: ['admin', 'settings'] as const,
  history: (key: string) => ['admin', 'settings', 'history', key] as const,
};

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: () => authedJson<Setting[]>('/api/v1/admin/settings'),
  });
}

// EF-ADM-02 — the change history for one setting key, loaded on demand.
export function useSettingHistory(key: string | null) {
  return useQuery({
    queryKey: settingsKeys.history(key ?? ''),
    enabled: !!key,
    queryFn: () =>
      authedJson<SettingHistoryEntry[]>(
        `/api/v1/admin/settings/${encodeURIComponent(key as string)}/history`,
      ),
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
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      void queryClient.invalidateQueries({
        queryKey: settingsKeys.history(input.key),
      });
    },
  });
}
