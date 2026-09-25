export const SAVED_SEARCH_ALERT_QUEUE = 'saved-search-alert-sweep';
export const SAVED_SEARCH_ALERT_JOB_NAME = 'saved-search-alert-sweep';
// A fixed jobId makes the repeatable-job REGISTRATION itself idempotent —
// re-adding it on every app restart with the same id/options is a no-op in
// BullMQ, never a duplicate schedule. (Same rationale as the cooldown sweep
// and percentile recalc.)
export const SAVED_SEARCH_ALERT_JOB_ID = 'saved-search-alert-sweep';
