'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { unwrap } from '@/lib/api';
import type { components } from '@/api/schema';

export type JobOffer = components['schemas']['JobOffer'];

export const jobKeys = {
  all: ['jobs'] as const,
  published: () => [...jobKeys.all, 'published'] as const,
};

export function usePublishedJobs() {
  return useQuery({
    queryKey: jobKeys.published(),
    queryFn: async () => {
      const data = (unwrap(await apiClient.GET('/api/v1/companies/offers')) ??
        []) as JobOffer[];
      return data.filter((o) => o.status === 'published');
    },
  });
}
