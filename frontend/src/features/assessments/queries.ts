'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { getAccessToken } from '@/auth/token-store';
import { unwrap } from '@/lib/api';
import type { components } from '@/api/schema';
import type { ManualResumeValues } from './schema';

export type Specialty = components['schemas']['SpecialtySummaryDto'];
export type TestSummary = components['schemas']['TestSummaryDto'];
export type RemediationFeedback = components['schemas']['RemediationFeedbackDto'];

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
