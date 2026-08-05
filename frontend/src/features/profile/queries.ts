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
    availability?: string | null;
    mobility?: string | null;
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

export const profileKeys = {
  all: ['profile'] as const,
  me: () => [...profileKeys.all, 'me'] as const,
  cv: () => [...profileKeys.all, 'cv'] as const,
  schoolVerification: () => [...profileKeys.all, 'school-verification'] as const,
  recruiterSelf: (userId?: string) => ['recruiter', 'self', userId] as const,
};

export function useCandidateProfile() {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: async () =>
      unwrap(
        await apiClient.GET('/api/v1/candidates/profile'),
      ) as unknown as CandidateProfileData,
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
