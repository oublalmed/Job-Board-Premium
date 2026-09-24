'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { getAccessToken } from '@/auth/token-store';
import { unwrap } from '@/lib/api';
import { sumUnread } from './queries.helpers';
import type { OpenConversationValues } from './schema';

// The conversation/message read endpoints post-date the last OpenAPI
// generation, so they use fetch + bearer token rather than the generated
// client (regenerate with `npm run generate:api` to fold them in).
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

export type MessageSenderRole = 'recruiter' | 'candidate';

export interface ConversationSummary {
  id: string;
  status: string;
  companyId: string;
  companyName: string | null;
  companyLogo: string | null;
  candidateProfileId: string;
  candidateName: string | null;
  counterpartName: string | null;
  lastMessage: {
    body: string;
    senderRole: MessageSenderRole;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

export interface MessageAttachment {
  originalName: string;
  mimeType: string;
  size: number;
}

export interface MessageView {
  id: string;
  body: string;
  senderRole: MessageSenderRole;
  mine: boolean;
  readAt: string | null;
  createdAt: string;
  // EF-MSG-03 — attachment metadata; the binary is fetched on demand via a
  // signed URL (fetchAttachmentUrl), never linked directly.
  attachment: MessageAttachment | null;
}

export const messageKeys = {
  all: ['conversations'] as const,
  list: () => [...messageKeys.all, 'list'] as const,
  thread: (id: string) => [...messageKeys.all, 'thread', id] as const,
};

export function useConversations() {
  return useQuery({
    queryKey: messageKeys.list(),
    queryFn: () => authedJson<ConversationSummary[]>('/api/v1/conversations'),
  });
}

// EF-MSG-02 — reuses the (cached, focus-refetched) conversations query so the
// nav badge stays in sync with the messages screen without a second request.
// `sumUnread` lives in queries.helpers.ts so it stays unit-testable without
// mocking this module's react-query hooks.
export function useUnreadMessageCount(): number {
  const { data } = useConversations();
  return sumUnread(data);
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: messageKeys.thread(conversationId ?? ''),
    enabled: !!conversationId,
    queryFn: () =>
      authedJson<MessageView[]>(
        `/api/v1/conversations/${conversationId}/messages`,
      ),
  });
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      authedJson(`/api/v1/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: messageKeys.thread(conversationId),
      });
      void queryClient.invalidateQueries({ queryKey: messageKeys.list() });
    },
  });
}

// EF-MSG-03 — attach ONE document (PDF/DOCX ≤5MB) to a new message. Uses raw
// FormData: Content-Type is left unset so the browser adds the multipart
// boundary itself (authedJson would force application/json).
export function useSendAttachment(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; body?: string }) => {
      const form = new FormData();
      form.append('file', input.file);
      if (input.body) form.append('body', input.body);
      const res = await fetch(
        `${BASE}/api/v1/conversations/${conversationId}/messages/attachment`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${getAccessToken()}` },
          body: form,
        },
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as MessageView;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: messageKeys.thread(conversationId),
      });
      void queryClient.invalidateQueries({ queryKey: messageKeys.list() });
    },
  });
}

// EF-MSG-03 — resolve a short-lived signed URL for an attachment on demand
// (authorized to the two conversation participants only).
export function fetchAttachmentUrl(conversationId: string, messageId: string) {
  return authedJson<{ url: string; originalName: string; mimeType: string }>(
    `/api/v1/conversations/${conversationId}/messages/${messageId}/attachment`,
  );
}

// EF-MSG-05 — flag a conversation for abuse.
export function useReportConversation(conversationId: string) {
  return useMutation({
    mutationFn: (reason: string) =>
      authedJson<{ id: string; status: string }>(
        `/api/v1/conversations/${conversationId}/report`,
        { method: 'POST', body: JSON.stringify({ reason }) },
      ),
  });
}

export function useOpenConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: OpenConversationValues) =>
      unwrap(
        await apiClient.POST('/api/v1/conversations', {
          body: {
            candidateProfileId: values.candidateProfileId,
            message: values.message,
          },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messageKeys.list() });
    },
  });
}
