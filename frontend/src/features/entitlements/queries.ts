'use client';

import { useQuery } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';

// Mirrors the backend Feature enum (src/modules/entitlements/feature.enum.ts).
// Keep in sync — these string values are the API contract.
export type Feature =
  | 'cv_database'
  | 'candidate_search'
  | 'profile_filter'
  | 'school_filter'
  | 'score_sort'
  | 'evaluations'
  | 'advanced_evaluations'
  | 'jobs'
  | 'applications'
  | 'shortlist'
  | 'anti_cheat'
  | 'basic_analytics'
  | 'advanced_analytics'
  | 'export_candidates'
  | 'api_access'
  | 'multi_user'
  | 'priority_support';

export type FeatureSource = 'package' | 'admin_override' | 'system';

export interface FeatureState {
  enabled: boolean;
  source: FeatureSource;
}

export interface CompanyEntitlements {
  companyId: string;
  plan: string | null;
  planDisplayName: string;
  active: boolean;
  features: Record<Feature, FeatureState>;
  limits: Record<string, number | null>;
}

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function authedJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

export const entitlementKeys = { all: ['entitlements'] as const };

// The caller's company entitlements — gates the UI in sync with the backend
// (§13). The endpoint post-dates the OpenAPI generation, so fetch + bearer.
export function useEntitlements() {
  return useQuery({
    queryKey: entitlementKeys.all,
    queryFn: () => authedJson<CompanyEntitlements>('/api/v1/entitlements'),
    staleTime: 5 * 60 * 1000,
  });
}

// Convenience: is a single feature enabled for the caller's company?
export function useFeature(feature: Feature): boolean {
  const { data } = useEntitlements();
  return data?.features?.[feature]?.enabled ?? false;
}
