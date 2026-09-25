'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { getAccessToken } from '@/auth/token-store';
import { unwrap } from '@/lib/api';
import type { components } from '@/api/schema';
import type { ManualResumeValues } from './schema';

export type Specialty = components['schemas']['SpecialtySummaryDto'];
export type TestSummary = components['schemas']['TestSummaryDto'];

// EF-CAND-09 — the feedback payload post-dates the last OpenAPI generation
// (it now carries per-resource completion + progress counts), so it is typed
// explicitly here rather than via the generated schema alias.
export interface RemediationResource {
  title: string;
  url: string;
  completed: boolean;
}

export interface RemediationFeedback {
  scoreValue: number;
  technicalScore: number | null;
  psychotechnicalScore: number | null;
  indexationThresholdMet: boolean;
  domainFeedback: { domain: string; level: 'weak' | 'medium' | 'strong' }[];
  resources: RemediationResource[];
  completedCount: number;
  totalCount: number;
  // Barème §5.2 — indexation/highlight thresholds + whether highlight is met.
  barème: {
    indexationScoreMin: number;
    indexationPercentileMin: number;
    highlightPercentileMin: number;
    highlightMet: boolean;
  };
  reEligibleAt: string | null;
}

export interface EvaluationComposition {
  techniqueWeight: number;
  psychotechniqueWeight: number;
  psychotechnicalItemTypes: string[];
}

export interface AssessmentHistoryItem {
  id: string;
  testId: string;
  specialtyName: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'incident';
  startedAt: string | null;
  completedAt: string | null;
  score: {
    value: number;
    percentile: number | null;
    technicalScore: number | null;
    psychotechnicalScore: number | null;
    // ISO date at which this score stops counting for indexation/ranking
    // (EF-EVAL-05 — 12-month validity). May be absent for legacy payloads.
    expiresAt: string | null;
  } | null;
}

export interface AssessmentHistory {
  items: AssessmentHistoryItem[];
  cooldownDays: number;
  eligibleNow: boolean;
  nextEligibleAt: string | null;
}

export const assessmentKeys = {
  all: ['assessments'] as const,
  catalog: () => [...assessmentKeys.all, 'catalog'] as const,
  history: () => [...assessmentKeys.all, 'history'] as const,
};

// Post-dates the last OpenAPI generation, so it uses fetch + bearer token
// rather than the generated client (regenerate with `npm run generate:api`).
export function useAssessmentHistory() {
  return useQuery({
    queryKey: assessmentKeys.history(),
    queryFn: async (): Promise<AssessmentHistory> => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/assessments/mine`,
        { headers: { Authorization: `Bearer ${getAccessToken()}` } },
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as AssessmentHistory;
    },
  });
}

// One query for the whole catalog: specialties + tests + evaluation
// composition are always shown together, so they share a cache entry and
// a single loading state.
export function useAssessmentCatalog() {
  return useQuery({
    queryKey: assessmentKeys.catalog(),
    queryFn: async () => {
      const [specialtiesRes, testsRes, compositionRes] = await Promise.all([
        apiClient.GET('/api/v1/specialties'),
        apiClient.GET('/api/v1/tests'),
        apiClient.GET('/api/v1/assessments/composition'),
      ]);
      return {
        specialties: (specialtiesRes.data ?? []) as Specialty[],
        tests: (testsRes.data ?? []) as TestSummary[],
        composition: (compositionRes.data ??
          null) as unknown as EvaluationComposition | null,
      };
    },
  });
}

export function useStartAssessment() {
  return useMutation({
    mutationFn: async (testId: string) =>
      unwrap(
        await apiClient.POST('/api/v1/assessments/start', { body: { testId } }),
      ),
  });
}

export function useResumeAssessment() {
  return useMutation({
    mutationFn: async (values: ManualResumeValues) =>
      unwrap(
        await apiClient.POST('/api/v1/assessments/resume', {
          body: {
            assessmentId: values.assessmentId.trim(),
            resumeToken: values.resumeToken.trim(),
          },
        }),
      ),
  });
}

export function useReportIncident() {
  return useMutation({
    mutationFn: async (assessmentId: string) =>
      unwrap(
        await apiClient.POST('/api/v1/assessments/{id}/incident', {
          params: { path: { id: assessmentId } },
        }),
      ),
  });
}

export function useAssessmentFeedback() {
  return useMutation({
    mutationFn: async (assessmentId: string) =>
      unwrap(
        await apiClient.GET('/api/v1/assessments/{id}/feedback', {
          params: { path: { id: assessmentId } },
        }),
      ),
  });
}

// EF-CAND-09 — lazy per-assessment feedback so a candidate can review the
// remediation guidance of any past completed attempt from their history, not
// just the active session. Only fetched once `enabled` (the row is expanded).
export function useAssessmentFeedbackQuery(
  assessmentId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...assessmentKeys.all, 'feedback', assessmentId] as const,
    enabled,
    queryFn: async (): Promise<RemediationFeedback> =>
      unwrap(
        await apiClient.GET('/api/v1/assessments/{id}/feedback', {
          params: { path: { id: assessmentId } },
        }),
      ) as RemediationFeedback,
  });
}

// EF-EVAL-02 / §5.3 — report the secure-exam client's cumulative tab-switch /
// window-blur counts for the in-progress attempt. Best-effort behavioural
// signal; the endpoint post-dates the generated schema, so raw fetch + bearer.
export function useReportProctoringEvents() {
  return useMutation({
    mutationFn: async (input: {
      assessmentId: string;
      tabSwitches: number;
      windowBlurs: number;
    }) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/assessments/${input.assessmentId}/proctoring-events`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({
            tabSwitches: input.tabSwitches,
            windowBlurs: input.windowBlurs,
          }),
        },
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
    },
  });
}

// EF-CAND-09 — toggle a remediation resource's completion. The PUT endpoint
// post-dates the generated schema, so it uses raw fetch + bearer. On success we
// invalidate the owning assessment's feedback so the progress re-renders.
export function useUpdateRemediationProgress(assessmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { url: string; completed: boolean }) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/assessments/remediation/progress`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify(input),
        },
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...assessmentKeys.all, 'feedback', assessmentId] as const,
      });
    },
  });
}
