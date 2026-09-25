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
  // Lot 7 (EF-REM-03) — when the daily cooldown-expiry sweep job runs.
  // Standard 5-field cron pattern, default daily at 03:00.
  cooldownSweepCron: process.env['COOLDOWN_SWEEP_CRON'] ?? '0 3 * * *',
  // EF-EVAL-04 — the daily percentile/ranking recalculation. Percentiles
  // are otherwise frozen at webhook time; this re-derives each active
  // score's standing against the current live cohort. Default daily at
  // 02:30, i.e. before the 03:00 cooldown sweep and indexation reads.
  percentileRecalcCron: process.env['PERCENTILE_RECALC_CRON'] ?? '30 2 * * *',
  // EF-SRCH-04 — when the saved-search alert sweep runs. For each saved
  // search with alerts enabled, it notifies the recruiter about candidates
  // newly indexed into the CVthèque since the last alert. Standard 5-field
  // cron, default daily at 07:00 (after the overnight indexation/recalc jobs).
  savedSearchAlertCron: process.env['SAVED_SEARCH_ALERT_CRON'] ?? '0 7 * * *',
  // EF-CAND-04 — external profile-link accessibility verification. Driver
  // selects the outbound prober: 'http' (default) performs a real SSRF-guarded
  // request; 'stub' keeps CI/dev hermetic (no network). Timeout bounds each
  // probe so a slow host never ties up a worker.
  linkProberDriver: process.env['LINK_PROBER_DRIVER'] ?? 'http',
  linkProbeTimeoutMs: parseInt(
    process.env['LINK_PROBE_TIMEOUT_MS'] ?? '5000',
    10,
  ),
  // Lot 7 (EF-GROW-04) — anti-spam window: N views by the same recruiter
  // on the same candidate within this window produce at most 1
  // notification (the view itself is still always recorded).
  profileViewNotificationCooldownHours: parseInt(
    process.env['PROFILE_VIEW_NOTIFICATION_COOLDOWN_HOURS'] ?? '24',
    10,
  ),
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
