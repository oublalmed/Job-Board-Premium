'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';
import type { CandidateFilters } from './types';

// EF-SRCH-04 — saved searches + alerts post-date the last OpenAPI generation,
// so they use fetch + bearer (regenerate with `npm run generate:api` to fold
// them into the typed client). Same authedJson pattern as admin/data-requests.
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function authedJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${getAccessToken()}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  // DELETE returns 204 No Content — nothing to parse.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// The persisted filter criteria — the subset of the candidate filters the
// backend stores (pagination is never saved).
export interface SavedSearchCriteria {
  q?: string;
  skills?: string[];
  scoreMin?: number;
  location?: string;
  availability?: string;
  salaryMax?: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  criteria: SavedSearchCriteria;
  alertEnabled: boolean;
  lastNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const savedSearchKeys = {
  all: ['saved-searches'] as const,
};

// Map the page's raw filter inputs (skills as a comma string) to the stored
// criteria shape, dropping empties so a saved search is minimal and matches
// what the search endpoint expects.
export function filtersToCriteria(f: CandidateFilters): SavedSearchCriteria {
  const criteria: SavedSearchCriteria = {};
  if (f.q.trim()) criteria.q = f.q.trim();
  const skills = f.skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (skills.length) criteria.skills = skills;
  if (f.location.trim()) criteria.location = f.location.trim();
  if (f.availability.trim()) criteria.availability = f.availability.trim();
  const salaryMax = Number(f.salaryMax);
  if (f.salaryMax.trim() && Number.isFinite(salaryMax) && salaryMax >= 0)
    criteria.salaryMax = salaryMax;
  return criteria;
}

// Inverse of filtersToCriteria — re-hydrate the page's filter inputs from a
// stored saved search so clicking it re-applies the exact filters.
export function criteriaToFilters(c: SavedSearchCriteria): CandidateFilters {
  return {
    q: c.q ?? '',
    skills: (c.skills ?? []).join(', '),
    location: c.location ?? '',
    availability: c.availability ?? '',
    salaryMax: c.salaryMax != null ? String(c.salaryMax) : '',
  };
}

export function useSavedSearches() {
  return useQuery({
    queryKey: savedSearchKeys.all,
    queryFn: () => authedJson<SavedSearch[]>('/api/v1/saved-searches'),
  });
}

export function useCreateSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      criteria: SavedSearchCriteria;
      alertEnabled?: boolean;
    }) =>
      authedJson<SavedSearch>('/api/v1/saved-searches', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedSearchKeys.all });
    },
  });
}

export function useUpdateSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      name?: string;
      criteria?: SavedSearchCriteria;
      alertEnabled?: boolean;
    }) => {
      const { id, ...body } = input;
      return authedJson<SavedSearch>(`/api/v1/saved-searches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedSearchKeys.all });
    },
  });
}

export function useDeleteSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authedJson<void>(`/api/v1/saved-searches/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedSearchKeys.all });
    },
  });
}
