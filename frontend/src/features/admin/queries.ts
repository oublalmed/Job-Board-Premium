'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { unwrap } from '@/lib/api';

export interface PendingVerification {
  id: string;
  candidateName: string | null;
  matchedSchool: string | null;
  confidence: number | string | null;
  createdAt: string;
}

export interface VerificationDetail {
  id: string;
  status: 'pending' | 'verified' | 'rejected';
  candidateName: string | null;
  ocrExtractedText: string | null;
  matchedSchool: string | null;
  confidence: number | string | null;
  documentUrl: string;
  documentName: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export const adminKeys = {
  all: ['admin', 'school-verifications'] as const,
  list: () => [...adminKeys.all, 'list'] as const,
  detail: (id: string) => [...adminKeys.all, 'detail', id] as const,
};

export function usePendingVerifications() {
  return useQuery({
    queryKey: adminKeys.list(),
    queryFn: async () =>
      (unwrap(await apiClient.GET('/api/v1/admin/school-verifications')) ??
        []) as unknown as PendingVerification[],
  });
}

export function useVerificationDetail(id: string) {
  return useQuery({
    queryKey: adminKeys.detail(id),
    enabled: !!id,
    queryFn: async () =>
      unwrap(
        await apiClient.GET('/api/v1/admin/school-verifications/{id}', {
          params: { path: { id } },
        }),
      ) as unknown as VerificationDetail,
  });
}

export interface ReviewInput {
  id: string;
  decision: 'verify' | 'reject';
  note?: string;
}

export function useReviewVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, note }: ReviewInput) => {
      const body = { note: note?.trim() || undefined };
      // Literal paths (not a variable) so openapi-fetch can resolve the
      // operation type for each endpoint.
      if (decision === 'verify') {
        return unwrap(
          await apiClient.PATCH('/api/v1/admin/school-verifications/{id}/verify', {
            params: { path: { id } },
            body,
          }),
        );
      }
      return unwrap(
        await apiClient.PATCH('/api/v1/admin/school-verifications/{id}/reject', {
          params: { path: { id } },
          body,
        }),
      );
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.list() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.detail(vars.id) });
    },
  });
}
