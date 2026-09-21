'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { unwrap } from '@/lib/api';
import { getAccessToken } from '@/auth/token-store';
import type { components } from '@/api/schema';

export type Notification = components['schemas']['Notification'];

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
};

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: async () =>
      (unwrap(await apiClient.GET('/api/v1/notifications')) ?? []) as Notification[],
  });
}

// The mark-as-read endpoints post-date the last OpenAPI generation, so they
// use fetch + bearer (regenerate with `npm run generate:api` to type them).
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function patch(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => patch(`/api/v1/notifications/${id}/read`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => patch('/api/v1/notifications/read-all'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
