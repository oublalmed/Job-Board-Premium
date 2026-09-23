// EF-CAND-04 — the per-link accessibility verification queue. Unlike the
// repeatable sweeps (cooldown / percentile / saved-search), this queue carries
// one-off jobs enqueued when a link is created or a re-check is requested; the
// job payload is the link id.
export const LINK_VERIFICATION_QUEUE = 'candidate-link-verification';
export const LINK_VERIFICATION_JOB_NAME = 'verify-link';

export interface LinkVerificationJobData {
  linkId: string;
}
