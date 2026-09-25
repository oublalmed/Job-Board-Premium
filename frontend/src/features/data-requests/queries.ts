'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';

// EF-ADM-03 (candidate side) — a data subject files a CNDP/RGPD request and
// tracks their own requests. The backend endpoints already exist but are not
// part of the generated openapi schema, so these hooks use raw fetch + bearer
// (the repo convention for endpoints not covered by `apiClient`).
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

export interface CreateDataRequestInput {
  type: DataRequestType;
  message?: string;
}

// Thrown on a 409 so the UI can specifically surface "an open request of this
// type already exists" rather than a generic error.
export class DataRequestConflictError extends Error {
  constructor() {
    super('conflict');
    this.name = 'DataRequestConflictError';
  }
}

export const dataRequestKeys = {
  all: ['data-requests'] as const,
  mine: () => [...dataRequestKeys.all, 'mine'] as const,
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

export function useMyDataRequests() {
  return useQuery({
    queryKey: dataRequestKeys.mine(),
    queryFn: async () => {
      const res = await fetchWithAuth('/api/v1/candidates/data/requests');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as DataRequest[];
    },
  });
}

export function useCreateDataRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDataRequestInput) => {
      const res = await fetchWithAuth('/api/v1/candidates/data/requests', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (res.status === 409) throw new DataRequestConflictError();
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as DataRequest;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dataRequestKeys.mine() });
    },
  });
}
