'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { unwrap } from '@/lib/api';
import type { Plan, TrialCodeValues } from './schema';

// Returns the Stripe checkout URL when the backend issues one; the page
// redirects there. successUrl/cancelUrl are built from window.location to
// match the original payload exactly.
export function useSubscribe() {
  return useMutation({
    mutationFn: async (plan: Plan): Promise<string | null> => {
      const { data, error } = await apiClient.POST('/api/v1/subscriptions', {
        body: {
          plan,
          successUrl: `${window.location.origin}/subscription?status=success`,
          cancelUrl: `${window.location.origin}/subscription?status=cancelled`,
        },
      });
      if (error) throw new Error('Subscription failed');
      return (data as unknown as { url?: string })?.url ?? null;
    },
  });
}

export function useChangePlan() {
  return useMutation({
    mutationFn: async (plan: Plan) =>
      unwrap(
        await apiClient.POST('/api/v1/subscriptions/plan', { body: { plan } }),
      ),
  });
}

export function useRedeemTrialCode() {
  return useMutation({
    mutationFn: async (values: TrialCodeValues) =>
      unwrap(
        await apiClient.POST('/api/v1/subscriptions/trial-code/redeem', {
          body: { code: values.code.trim() },
        }),
      ),
  });
}

export function useCancelSubscription() {
  return useMutation({
    mutationFn: async () =>
      unwrap(await apiClient.POST('/api/v1/subscriptions/cancel')),
  });
}
