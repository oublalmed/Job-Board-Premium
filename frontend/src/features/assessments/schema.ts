import { z } from 'zod';

// Manual resume from another device/browser: both fields required (the
// backend needs the assessment id + its resume token to re-issue a URL).
export const manualResumeSchema = z.object({
  assessmentId: z.string().trim().min(1),
  resumeToken: z.string().trim().min(1),
});

export type ManualResumeValues = z.infer<typeof manualResumeSchema>;

export const EMPTY_MANUAL_RESUME: ManualResumeValues = {
  assessmentId: '',
  resumeToken: '',
};
