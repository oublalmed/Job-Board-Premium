import { z } from 'zod';

// The review note is optional free text; the decision (verify/reject) is
// carried separately by the button the admin clicks.
export const reviewNoteSchema = z.object({
  note: z.string(),
});

export type ReviewNoteValues = z.infer<typeof reviewNoteSchema>;
