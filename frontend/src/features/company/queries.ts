'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { unwrap } from '@/lib/api';
import type { components } from '@/api/schema';
import {
  toAddRecruiterPayload,
  toCreateCompanyPayload,
  type AddRecruiterValues,
  type CreateCompanyValues,
} from './schema';

export type Company = components['schemas']['Company'];
export type Recruiter = components['schemas']['Recruiter'];

export const companyKeys = {
  all: ['company'] as const,
  me: () => [...companyKeys.all, 'me'] as const,
  recruiters: () => [...companyKeys.all, 'recruiters'] as const,
};

// Returns null (not an error) when the recruiter has no company yet — the
// backend answers /companies/me with an error in that case, and the page
// treats "no company" as "show the create form", exactly as before.
export function useCompany() {
  return useQuery({
    queryKey: companyKeys.me(),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/companies/me');
      if (error || !data) return null;
      return data as unknown as Company;
    },
  });
}

export function useRecruiters(enabled: boolean) {
  return useQuery({
    queryKey: companyKeys.recruiters(),
    enabled,
    queryFn: async () => {
      const { data } = await apiClient.GET('/api/v1/companies/recruiters');
      return (data ?? []) as unknown as Recruiter[];
    },
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: CreateCompanyValues) =>
      unwrap(
        await apiClient.POST('/api/v1/companies', {
          body: toCreateCompanyPayload(values) as never,
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companyKeys.all });
    },
  });
}

export function useAddRecruiter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: AddRecruiterValues) =>
      unwrap(
        await apiClient.POST('/api/v1/companies/recruiters', {
          body: toAddRecruiterPayload(values) as never,
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companyKeys.recruiters() });
    },
  });
}

export function useRemoveRecruiter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await apiClient.DELETE('/api/v1/companies/recruiters/{id}', {
          params: { path: { id } },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companyKeys.recruiters() });
    },
  });
}
