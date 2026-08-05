'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { unwrap } from '@/lib/api';

// GDPR/CNDP data export — a GET, but modeled as a mutation because it's a
// user-triggered action with pending/success feedback, not cached data.
export function useExportData() {
  return useMutation({
    mutationFn: async () =>
      unwrap(await apiClient.GET('/api/v1/candidates/data/export')),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () =>
      unwrap(await apiClient.DELETE('/api/v1/candidates/data')),
  });
}
