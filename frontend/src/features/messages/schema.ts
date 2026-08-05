import { z } from 'zod';

// Mirrors OpenConversationDto: candidateProfileId is a UUID, message is a
// non-empty string. Trimming matches the original page's payload shape.
export const openConversationSchema = z.object({
  candidateProfileId: z.string().trim().uuid(),
  message: z.string().trim().min(1),
});

export type OpenConversationValues = z.infer<typeof openConversationSchema>;

export const EMPTY_CONVERSATION: OpenConversationValues = {
  candidateProfileId: '',
  message: '',
};
