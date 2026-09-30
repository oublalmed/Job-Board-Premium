'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';
import { ApiError } from '@/lib/api';

// These endpoints post-date the OpenAPI generation, so we call them with a
// raw fetch + bearer (same pattern as entitlements / anti-cheat). The string
// values below are the API contract — mirror the backend enums in
// src/modules/jobs/entities/*.entity.ts. Keep them in sync.

export type JobStatus = 'draft' | 'published' | 'closed';

export type JobContractType =
  | 'CDI'
  | 'CDD'
  | 'PFE'
  | 'Freelance'
  | 'Internship';

export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'lead';

export type ApplicationStatus =
  | 'applied'
  | 'under_review'
  | 'shortlisted'
  | 'interview'
  | 'rejected'
  | 'accepted';

export const CONTRACT_TYPES: JobContractType[] = [
  'CDI',
  'CDD',
  'PFE',
  'Freelance',
  'Internship',
];

export const EXPERIENCE_LEVELS: ExperienceLevel[] = [
  'junior',
  'mid',
  'senior',
  'lead',
];

// The workflow a recruiter can move an application through (§3.4).
export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'applied',
  'under_review',
  'shortlisted',
  'interview',
  'accepted',
  'rejected',
];

export interface JobOffer {
  id: string;
  companyId: string;
  createdBy: string;
  title: string;
  description: string | null;
  location: string | null;
  contractType: JobContractType | null;
  experienceLevel: ExperienceLevel | null;
  skills: string[] | null;
  status: JobStatus;
  publishedAt: string | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string | null } | null;
}

export interface JobOfferWithCount extends JobOffer {
  applicationsCount: number;
}

export interface JobSearchResult {
  items: JobOfferWithCount[];
  total: number;
  page: number;
  limit: number;
}

export interface RecruiterApplication {
  id: string;
  status: ApplicationStatus;
  coverLetter: string | null;
  createdAt: string;
  candidate: {
    profileId: string;
    firstName: string | null;
    lastName: string | null;
    headline: string | null;
  };
}

export interface MyApplication {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  offer: {
    id: string;
    title: string;
    companyName: string | null;
    status: JobStatus;
  };
}

export interface JobFormValues {
  title: string;
  description?: string | null;
  location?: string | null;
  contractType?: JobContractType | null;
  experienceLevel?: ExperienceLevel | null;
  skills?: string[] | null;
  deadline?: string | null;
}

export interface JobSearchFilters {
  q?: string;
  location?: string;
  contractType?: JobContractType | '';
  skills?: string[];
}

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const PAGE_LIMIT = 12;

async function authed<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${getAccessToken()}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    throw new ApiError(`Request failed (${res.status})`, res.status, body);
  }
  // 204 / empty body tolerance.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const jobKeys = {
  all: ['jobs'] as const,
  recruiterList: () => [...jobKeys.all, 'recruiter', 'list'] as const,
  recruiterOne: (id: string) =>
    [...jobKeys.all, 'recruiter', 'offer', id] as const,
  applications: (offerId: string) =>
    [...jobKeys.all, 'recruiter', 'applications', offerId] as const,
  search: (filters: JobSearchFilters) =>
    [...jobKeys.all, 'search', filters] as const,
  detail: (id: string) => [...jobKeys.all, 'detail', id] as const,
  mine: () => [...jobKeys.all, 'mine'] as const,
};

// ---- recruiter (§3.1) ----

export function useRecruiterJobs(enabled = true) {
  return useQuery({
    queryKey: jobKeys.recruiterList(),
    enabled,
    queryFn: () => authed<JobOfferWithCount[]>('/api/v1/recruiter/jobs'),
  });
}

export function useRecruiterJob(id: string, enabled = true) {
  return useQuery({
    queryKey: jobKeys.recruiterOne(id),
    enabled: enabled && !!id,
    queryFn: () =>
      authed<JobOfferWithCount>(`/api/v1/recruiter/jobs/${id}`),
  });
}

export function useOfferApplications(offerId: string, enabled = true) {
  return useQuery({
    queryKey: jobKeys.applications(offerId),
    enabled: enabled && !!offerId,
    queryFn: () =>
      authed<RecruiterApplication[]>(
        `/api/v1/recruiter/jobs/${offerId}/applications`,
      ),
  });
}

function toPayload(values: JobFormValues) {
  return {
    title: values.title,
    description: values.description || null,
    location: values.location || null,
    contractType: values.contractType || null,
    experienceLevel: values.experienceLevel || null,
    skills: values.skills && values.skills.length > 0 ? values.skills : null,
    deadline: values.deadline || null,
  };
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: JobFormValues) =>
      authed<JobOffer>('/api/v1/recruiter/jobs', {
        method: 'POST',
        body: JSON.stringify(toPayload(values)),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: jobKeys.recruiterList() });
    },
  });
}

export function useUpdateJob(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: JobFormValues) =>
      authed<JobOffer>(`/api/v1/recruiter/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(toPayload(values)),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: jobKeys.recruiterOne(id) });
      void qc.invalidateQueries({ queryKey: jobKeys.recruiterList() });
    },
  });
}

export function usePublishJob(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      authed<JobOffer>(`/api/v1/recruiter/jobs/${id}/publish`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: jobKeys.recruiterOne(id) });
      void qc.invalidateQueries({ queryKey: jobKeys.recruiterList() });
    },
  });
}

export function useCloseJob(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      authed<JobOffer>(`/api/v1/recruiter/jobs/${id}/close`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: jobKeys.recruiterOne(id) });
      void qc.invalidateQueries({ queryKey: jobKeys.recruiterList() });
    },
  });
}

export function useUpdateApplicationStatus(offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { applicationId: string; status: ApplicationStatus }) =>
      authed<RecruiterApplication>(
        `/api/v1/recruiter/jobs/applications/${vars.applicationId}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: vars.status }),
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: jobKeys.applications(offerId) });
    },
  });
}

// ---- candidate / public (§3.2) ----

export function useJobSearch(filters: JobSearchFilters) {
  return useInfiniteQuery({
    queryKey: jobKeys.search(filters),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      if (filters.location) params.set('location', filters.location);
      if (filters.contractType) params.set('contractType', filters.contractType);
      if (filters.skills && filters.skills.length > 0)
        params.set('skills', filters.skills.join(','));
      params.set('page', String(pageParam));
      params.set('limit', String(PAGE_LIMIT));
      return authed<JobSearchResult>(`/api/v1/jobs?${params.toString()}`);
    },
    getNextPageParam: (last) =>
      last.page * last.limit < last.total ? last.page + 1 : undefined,
  });
}

export function useJobDetail(id: string, enabled = true) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    enabled: enabled && !!id,
    queryFn: () => authed<JobOfferWithCount>(`/api/v1/jobs/${id}`),
  });
}

export function useMyApplications(enabled = true) {
  return useQuery({
    queryKey: jobKeys.mine(),
    enabled,
    queryFn: () => authed<MyApplication[]>('/api/v1/jobs/mine/applications'),
  });
}

// §3 — eligibility to apply (profile >= 70% + >= 1 completed assessment).
export type EligibilityReason =
  | 'PROFILE_INCOMPLETE'
  | 'NO_COMPLETED_ASSESSMENT';

export interface ApplyEligibility {
  eligible: boolean;
  completeness: number;
  threshold: number;
  completedAssessments: number;
  reasons: EligibilityReason[];
}

export function useApplyEligibility(enabled = true) {
  return useQuery({
    queryKey: [...jobKeys.all, 'eligibility'] as const,
    enabled,
    queryFn: () =>
      authed<ApplyEligibility>('/api/v1/jobs/mine/eligibility'),
  });
}

export function useApplyToJob(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (coverLetter: string) =>
      authed(`/api/v1/jobs/${id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ coverLetter: coverLetter || undefined }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: jobKeys.mine() });
    },
  });
}
