'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { unwrap } from '@/lib/api';
import type { OpenConversationValues } from './schema';

export function useOpenConversation() {
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
  });
}
