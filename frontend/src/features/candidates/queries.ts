'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { ApiError, unwrap } from '@/lib/api';
import type {
  CandidateDetail,
  CandidateFilters,
  CandidateSearchResponse,
} from './types';

export const candidateKeys = {
  all: ['candidates'] as const,
  search: (filters: CandidateFilters) =>
    [...candidateKeys.all, 'search', filters] as const,
  detail: (id: string) => [...candidateKeys.all, 'detail', id] as const,
};

function buildQuery(
  filters: CandidateFilters,
  cursor?: string,
): Record<string, unknown> {
  const params: Record<string, unknown> = { limit: 20 };
  if (filters.q.trim()) params.q = filters.q.trim();
  const skills = filters.skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (skills.length) params.skills = skills;
  if (filters.location.trim()) params.location = filters.location.trim();
  if (filters.availability.trim()) params.availability = filters.availability.trim();
  if (filters.mobility.trim()) params.mobility = filters.mobility.trim();
  if (cursor) params.cursor = cursor;
  return params;
}

/** Cursor-paginated candidate search. Disabled until the recruiter searches. */
export function useCandidateSearch(filters: CandidateFilters, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: candidateKeys.search(filters),
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await apiClient.GET('/api/v1/search/candidates', {
          params: { query: buildQuery(filters, pageParam) as never },
        }),
      ) as unknown as CandidateSearchResponse,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useCandidateDetail(id: string) {
  return useQuery({
    queryKey: candidateKeys.detail(id),
    enabled: !!id,
    queryFn: async () =>
      unwrap(
        await apiClient.GET('/api/v1/search/candidates/{id}', {
          params: { path: { id } },
        }),
      ) as unknown as CandidateDetail,
  });
}

export interface AddToShortlistResult {
  duplicate: boolean;
}

// Duplicate shortlist entries come back as a plain 4xx with a message the
// backend already sends; we translate that one known case into a soft
// "already there" result instead of a hard error, and let anything else
// surface as a real ApiError for the mutation's error branch.
export function useAddToShortlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      candidateProfileId: string,
    ): Promise<AddToShortlistResult> => {
      // Only the 201 success is typed in the schema, so openapi-fetch
      // narrows away the error branch; `error` is still populated at
      // runtime for the (undocumented) 4xx duplicate case, which we read
      // defensively rather than relying on a typed shape.
      const { error } = await apiClient.POST('/api/v1/companies/shortlist', {
        body: { candidateProfileId },
      });
      if (error) {
        const msg = (error as { message?: string }).message ?? '';
        if (
          msg.includes('already') ||
          msg.includes('duplicate') ||
          msg.includes('unique')
        ) {
          return { duplicate: true };
        }
        throw new ApiError(msg || 'Failed to add to shortlist', 409, error);
      }
      return { duplicate: false };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shortlist'] });
    },
  });
}
