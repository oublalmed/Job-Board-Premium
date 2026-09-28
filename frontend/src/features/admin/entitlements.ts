'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';
import type { Feature, FeatureState } from '@/features/entitlements/queries';

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

export interface FeatureOverrideRow {
  id: string;
  feature: string;
  enabled: boolean;
  actorId: string | null;
  note: string | null;
  updatedAt: string;
}

export interface AdminCompanyEntitlements {
  companyId: string;
  plan: string | null;
  planDisplayName: string;
  active: boolean;
  features: Record<Feature, FeatureState>;
  limits: Record<string, number | null>;
  overrides: FeatureOverrideRow[];
  usage: { users: number };
}

export const adminEntitlementKeys = {
  company: (id: string) => ['admin', 'entitlements', id] as const,
};

export function useCompanyEntitlements(companyId: string | null) {
  return useQuery({
    queryKey: adminEntitlementKeys.company(companyId ?? ''),
    enabled: !!companyId,
    queryFn: () =>
      authed<AdminCompanyEntitlements>(
        `/api/v1/admin/companies/${companyId}/entitlements`,
      ),
  });
}

export function useSetFeatureOverride(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { feature: Feature; enabled: boolean; note?: string }) =>
      authed(
        `/api/v1/admin/companies/${companyId}/entitlements/features/${input.feature}`,
        {
          method: 'PUT',
          body: JSON.stringify({ enabled: input.enabled, note: input.note }),
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: adminEntitlementKeys.company(companyId),
      });
    },
  });
}

export function useClearFeatureOverride(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (feature: Feature) =>
      authed(
        `/api/v1/admin/companies/${companyId}/entitlements/features/${feature}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: adminEntitlementKeys.company(companyId),
      });
    },
  });
}
