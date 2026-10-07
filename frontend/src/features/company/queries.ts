'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { unwrap } from '@/lib/api';
import { getAccessToken } from '@/auth/token-store';
import type { components } from '@/api/schema';
import {
  toAddRecruiterPayload,
  toCreateCompanyPayload,
  type AddRecruiterValues,
  type CreateCompanyValues,
} from './schema';

export type Company = components['schemas']['Company'];
export type Recruiter = components['schemas']['Recruiter'];

// The /companies/recruiters endpoint returns a flat summary (id, userId,
// email, position) — NOT the full Recruiter entity the OpenAPI schema labels
// it with (which nests user). Type it to the real response so the UI can show
// the recruiter's email instead of falling back to the raw user id.
export interface CompanyRecruiter {
  id: string;
  userId: string;
  email: string;
  position: string | null;
  createdAt?: string;
}

export const companyKeys = {
  all: ['company'] as const,
  me: () => [...companyKeys.all, 'me'] as const,
  recruiters: () => [...companyKeys.all, 'recruiters'] as const,
  invitations: () => [...companyKeys.all, 'invitations'] as const,
};

// Recruiter invitations — not in the generated OpenAPI schema, so these use
// raw fetch + bearer (the repo convention for endpoints apiClient can't type).
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function invitationFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${getAccessToken()}`,
      ...(init.headers ?? {}),
    },
  });
}

export interface PendingInvitation {
  id: string;
  email: string;
  position: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface InviteRecruiterInput {
  email: string;
  position?: string;
}

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
      return (data ?? []) as unknown as CompanyRecruiter[];
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

export function useRecruiterInvitations(enabled: boolean) {
  return useQuery({
    queryKey: companyKeys.invitations(),
    enabled,
    queryFn: async () => {
      const res = await invitationFetch('/api/v1/companies/recruiters/invitations');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as PendingInvitation[];
    },
  });
}

export function useInviteRecruiter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteRecruiterInput) => {
      const res = await invitationFetch(
        '/api/v1/companies/recruiters/invitations',
        { method: 'POST', body: JSON.stringify(input) },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message ?? `Request failed (${res.status})`);
      }
      return (await res.json()) as { status: 'attached' | 'invited' };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companyKeys.invitations() });
      void queryClient.invalidateQueries({ queryKey: companyKeys.recruiters() });
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await invitationFetch(
        `/api/v1/companies/recruiters/invitations/${id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companyKeys.invitations() });
    },
  });
}
