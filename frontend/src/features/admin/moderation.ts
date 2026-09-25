'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';

// EF-ADM-04 / EF-ADM-01 admin endpoints post-date the last OpenAPI
// generation, so they use fetch + bearer (regenerate with
// `npm run generate:api` to fold them into the typed client).
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

// ---- EF-ADM-04: audit log ----
export interface AuditLogItem {
  id: string;
  action: string;
  actorId: string | null;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogPage {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

export function useAuditLogs(page: number, action?: string) {
  return useQuery({
    queryKey: ['admin', 'audit-logs', page, action ?? 'all'] as const,
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (action) params.set('action', action);
      return authedJson<AuditLogPage>(`/api/v1/admin/audit-logs?${params}`);
    },
  });
}

// ---- EF-ADM-01 / EF-MSG-05: message-report moderation queue ----
export type ReportStatus = 'open' | 'reviewed' | 'dismissed';

export interface MessageReport {
  id: string;
  conversationId: string;
  reporterUserId: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
}

export const reportKeys = {
  all: ['admin', 'message-reports'] as const,
  list: (status: string) => [...reportKeys.all, status] as const,
};

export function useMessageReports(status?: ReportStatus) {
  return useQuery({
    queryKey: reportKeys.list(status ?? 'all'),
    queryFn: () =>
      authedJson<MessageReport[]>(
        `/api/v1/admin/message-reports${status ? `?status=${status}` : ''}`,
      ),
  });
}

export function useUpdateReportStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: ReportStatus }) =>
      authedJson<{ id: string; status: string }>(
        `/api/v1/admin/message-reports/${input.id}`,
        { method: 'PATCH', body: JSON.stringify({ status: input.status }) },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}
