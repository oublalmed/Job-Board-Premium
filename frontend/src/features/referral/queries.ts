'use client';

import { useQuery } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';

export interface ReferralInfo {
  code: string;
  signups: number;
  conversions: number;
}

// EF-GROW-02 (Lot 7). Post-dates the last OpenAPI generation, so — like the
// score badge — it uses fetch + bearer rather than the generated client.
// Regenerate with `npm run generate:api` against a live backend to fold it in.
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export function useReferral() {
  return useQuery({
    queryKey: ['referral', 'mine'],
    queryFn: async (): Promise<ReferralInfo> => {
      const res = await fetch(`${BASE}/api/v1/candidates/referral`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as ReferralInfo;
    },
  });
}
