'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { getAccessToken } from '@/auth/token-store';
import { unwrap } from '@/lib/api';

// GDPR/CNDP data export — a GET, but modeled as a mutation because it's a
// user-triggered action with pending/success feedback, not cached data.
export function useExportData() {
  return useMutation({
    mutationFn: async () =>
      unwrap(await apiClient.GET('/api/v1/candidates/data/export')),
  });
}

// EF-CAND-08 — the same portability export as a downloadable PDF. Post-dates
// the last OpenAPI generation and returns a binary attachment (not JSON), so
// it uses fetch + bearer directly and streams the blob to a browser download.
export function useExportDataPdf() {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/candidates/data/export/pdf`,
        { headers: { Authorization: `Bearer ${getAccessToken()}` } },
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'mes-donnees-personnelles.pdf';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () =>
      unwrap(await apiClient.DELETE('/api/v1/candidates/data')),
  });
}
