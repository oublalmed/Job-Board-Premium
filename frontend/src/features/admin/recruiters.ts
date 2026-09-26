'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';
import { subscriptionAdminKeys, type SubscriptionPlan } from './subscriptions';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export interface CreateRecruiterInput {
  email: string;
  position?: string;
  companyId?: string;
  companyName?: string;
  plan?: SubscriptionPlan;
  contactQuota?: number;
}

export interface CreatedRecruiter {
  recruiterId: string;
  userId: string;
  email: string;
  companyId: string;
  companyName: string;
  plan: SubscriptionPlan | null;
}

// Admin provisions a recruiter account. On success we refresh the admin
// subscriptions caches (a new company/plan may now exist). Uses fetch + bearer:
// the endpoint post-dates the generated OpenAPI client, and surfaces the
// backend's error message so the form can show a real reason (e.g. email taken).
export function useCreateRecruiter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRecruiterInput): Promise<CreatedRecruiter> => {
      const res = await fetch(`${BASE}/api/v1/admin/recruiters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
          const body = (await res.json()) as { message?: string | string[] };
          if (Array.isArray(body.message)) message = body.message.join(', ');
          else if (body.message) message = body.message;
        } catch {
          /* keep the status-code message */
        }
        throw new Error(message);
      }
      return (await res.json()) as CreatedRecruiter;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionAdminKeys.all });
    },
  });
}
