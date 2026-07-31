export const COOLDOWN_QUEUE = 'remediation-cooldown-sweep';
export const COOLDOWN_SWEEP_JOB_NAME = 'daily-cooldown-sweep';
// A fixed jobId makes the repeatable-job REGISTRATION itself idempotent —
// re-adding it on every app restart with the same id/options is a no-op in
// BullMQ, never a duplicate schedule.
export const COOLDOWN_SWEEP_JOB_ID = 'daily-cooldown-sweep';
