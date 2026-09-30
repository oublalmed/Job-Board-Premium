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

async function authedGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

export function useFunnel(days?: number) {
  return useQuery({
    queryKey: ['analytics', 'funnel', days ?? 'all'],
    queryFn: () =>
      authedGet<Funnel>(
        `/api/v1/admin/analytics/funnel${days ? `?days=${days}` : ''}`,
      ),
  });
}

// ---- §4 recruiter analytics ----

export type ApplicationStatusKey =
  | 'applied'
  | 'under_review'
  | 'shortlisted'
  | 'interview'
  | 'rejected'
  | 'accepted';

export interface RecruiterAnalytics {
  rangeDays: number;
  jobs: { total: number; published: number; draft: number; closed: number };
  applications: {
    total: number;
    byStatus: Record<ApplicationStatusKey, number>;
  };
  shortlist: { total: number };
  conversations: { total: number };
  contacts: { used: number; quota: number | null };
  applicationsTrend: { date: string; count: number }[];
  topOffers: { id: string; title: string; applications: number }[];
}

export function useRecruiterAnalytics(days = 30, enabled = true) {
  return useQuery({
    queryKey: ['analytics', 'recruiter', days],
    enabled,
    queryFn: () =>
      authedGet<RecruiterAnalytics>(
        `/api/v1/recruiter/analytics/overview?days=${days}`,
      ),
  });
}

// ---- §5 admin platform overview ----

export type PlanKey = 'starter' | 'growth' | 'scale' | 'enterprise';

export interface AdminOverview {
  users: { total: number; candidates: number; recruiters: number };
  companies: { total: number };
  subscriptions: { active: number; byPlan: Record<PlanKey, number> };
  jobs: { total: number; published: number };
  applications: { total: number };
  assessments: { total: number; completed: number };
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ['analytics', 'admin', 'overview'],
    queryFn: () => authedGet<AdminOverview>('/api/v1/admin/analytics/overview'),
  });
}
