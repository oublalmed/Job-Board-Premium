'use client';

import { useQuery } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';

export type FunnelStepType =
  | 'signup'
  | 'email_verified'
  | 'test_started'
  | 'score_obtained'
  | 'recruiter_contact'
  | 'subscription_created';

export interface FunnelStep {
  type: FunnelStepType;
  count: number;
}

export interface Funnel {
  rangeDays: number | null;
  steps: FunnelStep[];
}

// EF-ADM-05 (Lot 8). Admin-only; post-dates the last OpenAPI generation so
// it uses fetch + bearer. Regenerate with `npm run generate:api` to type it.
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export function useFunnel(days?: number) {
  return useQuery({
    queryKey: ['analytics', 'funnel', days ?? 'all'],
    queryFn: async (): Promise<Funnel> => {
      const query = days ? `?days=${days}` : '';
      const res = await fetch(`${BASE}/api/v1/admin/analytics/funnel${query}`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as Funnel;
    },
  });
}
