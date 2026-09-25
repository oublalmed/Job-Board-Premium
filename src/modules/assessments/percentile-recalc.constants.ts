export const PERCENTILE_RECALC_QUEUE = 'assessment-percentile-recalc';
export const PERCENTILE_RECALC_JOB_NAME = 'daily-percentile-recalc';
// A fixed jobId makes the repeatable-job REGISTRATION itself idempotent —
// re-adding it on every app restart with the same id/options is a no-op in
// BullMQ, never a duplicate schedule. (Same rationale as the cooldown sweep.)
export const PERCENTILE_RECALC_JOB_ID = 'daily-percentile-recalc';
