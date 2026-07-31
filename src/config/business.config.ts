import { registerAs } from '@nestjs/config';

export const businessConfig = registerAs('business', () => ({
  profileCompletenessThreshold: parseInt(
    process.env['PROFILE_COMPLETENESS_THRESHOLD'] ?? '70',
    10,
  ),
  indexationScoreThreshold: parseInt(
    process.env['INDEXATION_SCORE_THRESHOLD'] ?? '40',
    10,
  ),
  indexationPercentileThreshold: parseInt(
    process.env['INDEXATION_PERCENTILE_THRESHOLD'] ?? '30',
    10,
  ),
  highlightPercentileThreshold: parseInt(
    process.env['HIGHLIGHT_PERCENTILE_THRESHOLD'] ?? '75',
    10,
  ),
  scoreValidityMonths: parseInt(
    process.env['SCORE_VALIDITY_MONTHS'] ?? '12',
    10,
  ),
  retestCooldownDays: parseInt(process.env['RETEST_COOLDOWN_DAYS'] ?? '90', 10),
  trialDurationDays: parseInt(process.env['TRIAL_DURATION_DAYS'] ?? '14', 10),
  // Lot 6D — PAST_DUE keeps full access for this many days from
  // pastDueSince (Stripe Smart Retries running) before access is
  // restricted (US-BILL-04). Not the Stripe retry count/cadence itself —
  // that lives entirely in the Stripe dashboard config, never here.
  subscriptionGracePeriodDays: parseInt(
    process.env['SUBSCRIPTION_GRACE_PERIOD_DAYS'] ?? '7',
    10,
  ),
  maxCvSizeBytes: parseInt(process.env['MAX_CV_SIZE_BYTES'] ?? '5242880', 10),
  currency: process.env['CURRENCY'] ?? 'MAD',
  plans: {
    starter: {
      price: parseInt(process.env['PLAN_STARTER_PRICE'] ?? '990', 10),
      contacts: parseInt(process.env['PLAN_STARTER_CONTACTS'] ?? '15', 10),
      offers: parseInt(process.env['PLAN_STARTER_OFFERS'] ?? '1', 10),
      users: parseInt(process.env['PLAN_STARTER_USERS'] ?? '1', 10),
    },
    growth: {
      price: parseInt(process.env['PLAN_GROWTH_PRICE'] ?? '2900', 10),
      contacts: parseInt(process.env['PLAN_GROWTH_CONTACTS'] ?? '60', 10),
      offers: parseInt(process.env['PLAN_GROWTH_OFFERS'] ?? '5', 10),
      users: parseInt(process.env['PLAN_GROWTH_USERS'] ?? '3', 10),
    },
    scale: {
      price: parseInt(process.env['PLAN_SCALE_PRICE'] ?? '6900', 10),
      contacts: parseInt(process.env['PLAN_SCALE_CONTACTS'] ?? '200', 10),
      offers: parseInt(process.env['PLAN_SCALE_OFFERS'] ?? '20', 10),
      users: parseInt(process.env['PLAN_SCALE_USERS'] ?? '10', 10),
    },
  },
}));
