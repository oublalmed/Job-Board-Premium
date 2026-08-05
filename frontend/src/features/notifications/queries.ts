'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { unwrap } from '@/lib/api';
import type { components } from '@/api/schema';

export type Notification = components['schemas']['Notification'];

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
};

// The backend exposes only GET /notifications (list-mine) — there is no
// mark-as-read endpoint, so this feature is read-only by design.
export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: async () =>
      (unwrap(await apiClient.GET('/api/v1/notifications')) ?? []) as Notification[],
  });
}
