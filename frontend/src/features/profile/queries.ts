'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { unwrap } from '@/lib/api';
import { getAccessToken } from '@/auth/token-store';
import { toUpdatePayload, type ProfileFormValues } from './schema';

export interface CandidateProfileData {
  profile: {
    firstName?: string | null;
    lastName?: string | null;
    headline?: string | null;
    bio?: string | null;
    location?: string | null;
    school?: string | null;
    schoolVerified?: boolean;
    visibility?: 'public' | 'recruiters_only' | 'hidden';
  };
  completeness: {
    completeness: number;
    isPublishable: boolean;
    missing: { key: string; label: string; weight: number }[];
  };
}

export interface CvInfo {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  scanStatus: string;
}

export type SchoolVerificationStatus = 'pending' | 'verified' | 'rejected';

export interface SchoolVerification {
  id: string;
  status: SchoolVerificationStatus;
  matchedSchool: string | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface RecruiterSummary {
  id: string;
  userId: string;
  email: string;
  position: string | null;
  createdAt: string;
}

export type ProfileLinkType = 'github' | 'portfolio' | 'linkedin' | 'other';

export interface ProfileLink {
  id: string;
  type: ProfileLinkType;
  url: string;
  label: string | null;
  createdAt: string;
}

export interface CreateProfileLinkInput {
  type: ProfileLinkType;
  url: string;
  label?: string;
}

// EF-CAND-07 — structured certifications. The backend endpoints are not part
// of the generated openapi schema, so these hooks use raw fetch + bearer
// (the repo convention for endpoints not covered by `apiClient`).
export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate: string | null;
  credentialUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CertificationInput {
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialUrl?: string;
}

export const profileKeys = {
  all: ['profile'] as const,
  me: () => [...profileKeys.all, 'me'] as const,
  cv: () => [...profileKeys.all, 'cv'] as const,
  schoolVerification: () => [...profileKeys.all, 'school-verification'] as const,
  links: () => [...profileKeys.all, 'links'] as const,
  certifications: () => [...profileKeys.all, 'certifications'] as const,
  projects: () => [...profileKeys.all, 'projects'] as const,
  recruiterSelf: (userId?: string) => ['recruiter', 'self', userId] as const,
};

async function fetchWithAuth(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${getAccessToken()}`,
      ...(init.headers ?? {}),
    },
  });
}

export function useCandidateProfile() {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: async () =>
      unwrap(
        await apiClient.GET('/api/v1/candidates/profile'),
      ) as unknown as CandidateProfileData,
  });
}

// Lightweight completeness-only fetch for the dashboard, which needs just
// the percentage and shouldn't pull the whole profile payload.
export function useCompleteness(enabled: boolean) {
  return useQuery({
    queryKey: [...profileKeys.all, 'completeness-number'] as const,
    enabled,
    queryFn: async () => {
      const data = unwrap(
        await apiClient.GET('/api/v1/candidates/profile/completeness'),
      ) as { completeness: number };
      return data.completeness;
    },
  });
}

export function useCandidateCv() {
  return useQuery({
    queryKey: profileKeys.cv(),
    queryFn: async () => {
      const data = unwrap(await apiClient.GET('/api/v1/candidates/cv')) as {
        cv: CvInfo | null;
      };
      return data.cv;
    },
  });
}

export function useSchoolVerification() {
  return useQuery({
    queryKey: profileKeys.schoolVerification(),
    queryFn: async () => {
      const data = unwrap(
        await apiClient.GET('/api/v1/candidates/school-verification'),
      ) as { verification: SchoolVerification | null };
      return data.verification;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: ProfileFormValues) =>
      unwrap(
        await apiClient.PUT('/api/v1/candidates/profile', {
          body: toUpdatePayload(values) as never,
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

export function useDeleteCv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(await apiClient.DELETE('/api/v1/candidates/cv')),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.cv() });
      void queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

// Multipart uploads bypass openapi-fetch (it targets JSON): raw fetch +
// bearer token, preserved exactly from the original page. Wrapped as
// mutations only for consistent pending state and cache invalidation.
async function uploadFile(path: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getAccessToken()}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

export function useUploadCv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadFile('/api/v1/candidates/cv', file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.cv() });
      void queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

export function useUploadDiploma() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      uploadFile('/api/v1/candidates/school-verification', file),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: profileKeys.schoolVerification(),
      });
    },
  });
}

// EF-CAND-04 — external profile links (github/portfolio/linkedin/other).
// The backend CRUD existed but no UI ever called it.
export function useProfileLinks() {
  return useQuery({
    queryKey: profileKeys.links(),
    queryFn: async () =>
      (unwrap(await apiClient.GET('/api/v1/candidates/links')) ??
        []) as unknown as ProfileLink[],
  });
}

export function useAddProfileLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProfileLinkInput) =>
      unwrap(
        await apiClient.POST('/api/v1/candidates/links', {
          body: input as never,
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.links() });
      void queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

export function useDeleteProfileLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await apiClient.DELETE('/api/v1/candidates/links/{id}', {
          params: { path: { id } },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.links() });
      void queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

// EF-CAND-07 — certifications CRUD (raw fetch + bearer; see fetchWithAuth).
export function useCertifications() {
  return useQuery({
    queryKey: profileKeys.certifications(),
    queryFn: async () => {
      const res = await fetchWithAuth('/api/v1/candidates/certifications');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as Certification[];
    },
  });
}

export function useAddCertification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CertificationInput) => {
      const res = await fetchWithAuth('/api/v1/candidates/certifications', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as Certification;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: profileKeys.certifications(),
      });
      void queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

export function useUpdateCertification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: CertificationInput;
    }) => {
      const res = await fetchWithAuth(
        `/api/v1/candidates/certifications/${id}`,
        { method: 'PUT', body: JSON.stringify(input) },
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as Certification;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: profileKeys.certifications(),
      });
    },
  });
}

export function useDeleteCertification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(
        `/api/v1/candidates/certifications/${id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: profileKeys.certifications(),
      });
      void queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

export function useRecruiterSelf(userId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.recruiterSelf(userId),
    enabled: !!userId,
    queryFn: async () => {
      const [recruitersRes, companyRes] = await Promise.all([
        apiClient.GET('/api/v1/companies/recruiters'),
        apiClient.GET('/api/v1/companies/me'),
      ]);
      const list = (recruitersRes.data ?? []) as unknown as RecruiterSummary[];
      const companyData = companyRes.data as
        | { company?: { name?: string } }
        | undefined;
      return {
        recruiter: list.find((r) => r.userId === userId) ?? null,
        companyName: companyData?.company?.name ?? null,
      };
    },
  });
}

// EF-CAND-07 — structured projects. Same raw fetch + bearer pattern as
// certifications: the endpoints post-date the generated OpenAPI client.
export interface Project {
  id: string;
  title: string;
  description: string;
  url: string | null;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ProjectInput {
  title: string;
  description: string;
  url?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
}
export function useProjects() {
  return useQuery({
    queryKey: profileKeys.projects(),
    queryFn: async () => {
      const res = await fetchWithAuth('/api/v1/candidates/projects');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as Project[];
    },
  });
}
export function useAddProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProjectInput) => {
      const res = await fetchWithAuth('/api/v1/candidates/projects', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as Project;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.projects() });
      void queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}
export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ProjectInput }) => {
      const res = await fetchWithAuth(`/api/v1/candidates/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as Project;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.projects() });
    },
  });
}
export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(`/api/v1/candidates/projects/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.projects() });
      void queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}
