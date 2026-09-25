'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';

// EF-ADM-01 admin profile-moderation endpoints post-date the last OpenAPI
// generation, so they use fetch + bearer (regenerate with `npm run generate:api`).
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

export type ProfileModerationStatus = 'active' | 'suspended';

export interface ModeratedProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  visibility: string;
  moderationStatus: ProfileModerationStatus;
  createdAt: string;
}

export interface ModeratedProfilesPage {
  items: ModeratedProfile[];
  total: number;
}

export const adminProfileKeys = {
  all: ['admin', 'profiles'] as const,
  list: (status: string) => ['admin', 'profiles', status] as const,
};

export function useModeratedProfiles(status: ProfileModerationStatus | 'all') {
  return useQuery({
    queryKey: adminProfileKeys.list(status),
    queryFn: () =>
      authedJson<ModeratedProfilesPage>(
        `/api/v1/admin/profiles?limit=100${status === 'all' ? '' : `&status=${status}`}`,
      ),
  });
}

export function useModerateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: ProfileModerationStatus }) =>
      authedJson<ModeratedProfile>(
        `/api/v1/admin/profiles/${input.id}/moderation`,
        { method: 'PATCH', body: JSON.stringify({ status: input.status }) },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminProfileKeys.all });
    },
  });
}
