'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';

// Admin subscriptions overview post-dates the last OpenAPI generation, so it
// uses fetch + bearer (same convention as the other admin queues).
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

export type SubscriptionPlan = 'starter' | 'growth' | 'scale' | 'enterprise';
export type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'cancelled'
  | 'expired';

export interface AdminSubscription {
  id: string;
  companyId: string;
  companyName: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startsAt: string;
  endsAt: string | null;
  contactQuota: number;
  contactsUsed: number;
  cancelAtPeriodEnd: boolean;
  pastDueSince: string | null;
}

export interface AdminSubscriptionList {
  items: AdminSubscription[];
  counts: Record<string, number>;
}

export const subscriptionAdminKeys = {
  all: ['admin', 'subscriptions'] as const,
  list: (status: string) => [...subscriptionAdminKeys.all, status] as const,
};

export function useAdminSubscriptions(status: string) {
  return useQuery({
    queryKey: subscriptionAdminKeys.list(status),
    queryFn: () => {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      const qs = params.toString();
      return authedJson<AdminSubscriptionList>(
        `/api/v1/admin/subscriptions${qs ? `?${qs}` : ''}`,
      );
    },
  });
}

// Shared factory for the PATCH actions (cancel / suspend / reactivate): each
// hits /admin/subscriptions/:id/<action> and refreshes the list + tiles.
function useSubscriptionAction(action: 'cancel' | 'suspend' | 'reactivate') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authedJson<AdminSubscription>(
        `/api/v1/admin/subscriptions/${id}/${action}`,
        { method: 'PATCH' },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionAdminKeys.all });
    },
  });
}

export function useCancelSubscription() {
  return useSubscriptionAction('cancel');
}

// Place an unpaid company on hold (reversible — see useReactivateSubscription).
export function useSuspendSubscription() {
  return useSubscriptionAction('suspend');
}

// Lift the hold: SUSPENDED -> ACTIVE.
export function useReactivateSubscription() {
  return useSubscriptionAction('reactivate');
}
