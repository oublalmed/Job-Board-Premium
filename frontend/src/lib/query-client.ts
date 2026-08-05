'use client';

import { QueryClient } from '@tanstack/react-query';

// One QueryClient per browser tab. Defaults tuned for a dashboard SPA:
// - staleTime 30s: route changes between sibling pages don't trigger a
//   refetch storm; data is considered fresh for half a minute.
// - retry 1: the openapi-fetch middleware already transparently refreshes
//   the access token on 401, so a second network retry is enough to cover
//   transient blips without masking real failures.
// - refetchOnWindowFocus off: this app is form-heavy; silent background
//   refetches while a recruiter is mid-edit are surprising, not helpful.
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
