'use client';

import { useQuery } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export interface IntegrityRow {
  assessmentId: string;
  candidateEmail: string | null;
  specialtyName: string | null;
  status: string;
  score: number | null;
  tabSwitchCount: number;
  windowBlurCount: number;
  proctoringFlagged: boolean;
  multiAccountFlagged: boolean;
  plagiarismVerdict: string | null;
  ipAddress: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface IntegrityList {
  items: IntegrityRow[];
  counts: {
    proctoring: number;
    multiAccount: number;
    plagiarism: number;
    total: number;
  };
}

// Admin exam-integrity / anti-cheat overview. Uses fetch + bearer (post-dates
// the generated OpenAPI client).
export function useAssessmentIntegrity(scope: 'flagged' | 'all') {
  return useQuery({
    queryKey: ['admin', 'assessment-integrity', scope] as const,
    queryFn: async (): Promise<IntegrityList> => {
      const qs = scope === 'all' ? '?scope=all' : '';
      const res = await fetch(
        `${BASE}/api/v1/admin/assessment-integrity${qs}`,
        { headers: { Authorization: `Bearer ${getAccessToken()}` } },
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as IntegrityList;
    },
  });
}
