'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';

// EF-ADM-03 — the CNDP/RGPD data-request queue post-dates the last OpenAPI
// generation, so it uses fetch + bearer (regenerate with
// `npm run generate:api` to fold it into the typed client).
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
  return (await res.json()) as T;
}

export type DataRequestType =
  | 'access'
  | 'portability'
  | 'erasure'
  | 'rectification'
  | 'objection';

export type DataRequestStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'rejected';

// Resolutions an admin can apply (pending is the initial state only).
export type DataRequestResolution = 'in_progress' | 'completed' | 'rejected';

export interface DataRequest {
  id: string;
  userId: string;
  type: DataRequestType;
  status: DataRequestStatus;
  message: string | null;
  resolutionNote: string | null;
  handledByUserId: string | null;
  dueAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataRequestPage {
  items: DataRequest[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

export const dataRequestKeys = {
  all: ['admin', 'data-requests'] as const,
  list: (status: string, page: number) =>
    [...dataRequestKeys.all, status, page] as const,
};

export function useDataRequests(status: string, page: number) {
  return useQuery({
    queryKey: dataRequestKeys.list(status, page),
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status !== 'all') params.set('status', status);
      return authedJson<DataRequestPage>(
        `/api/v1/admin/data-requests?${params}`,
      );
    },
  });
}

export function useResolveDataRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      status: DataRequestResolution;
      resolutionNote?: string;
    }) =>
      authedJson<DataRequest>(`/api/v1/admin/data-requests/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: input.status,
          ...(input.resolutionNote
            ? { resolutionNote: input.resolutionNote }
            : {}),
        }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dataRequestKeys.all });
    },
  });
}
