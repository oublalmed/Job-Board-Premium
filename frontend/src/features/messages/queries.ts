'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { getAccessToken } from '@/auth/token-store';
import { unwrap } from '@/lib/api';
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

export interface MessageView {
  id: string;
  body: string;
  senderRole: MessageSenderRole;
  mine: boolean;
  readAt: string | null;
  createdAt: string;
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
