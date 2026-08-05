'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { unwrap } from '@/lib/api';
import type { components } from '@/api/schema';

export type ShortlistEntry = components['schemas']['ShortlistEntry'];

// Key root is ['shortlist'] so useAddToShortlist (candidates feature) can
// invalidate this list by prefix after adding a candidate.
export const shortlistKeys = {
  all: ['shortlist'] as const,
  list: () => [...shortlistKeys.all, 'list'] as const,
};

export function useShortlist() {
  return useQuery({
    queryKey: shortlistKeys.list(),
    queryFn: async () =>
      (unwrap(await apiClient.GET('/api/v1/companies/shortlist')) ??
        []) as ShortlistEntry[],
  });
}

export function useRemoveShortlistEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await apiClient.DELETE('/api/v1/companies/shortlist/{id}', {
          params: { path: { id } },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: shortlistKeys.all });
    },
  });
}
