import { z } from 'zod';

export const PLANS = ['starter', 'growth', 'scale', 'enterprise'] as const;
export type Plan = (typeof PLANS)[number];

// Mirrors RedeemTrialCodeDto: a single non-empty code.
export const trialCodeSchema = z.object({
  code: z.string().trim().min(1),
});

export type TrialCodeValues = z.infer<typeof trialCodeSchema>;
