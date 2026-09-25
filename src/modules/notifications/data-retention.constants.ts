// ENF-12 — data-retention sweep queue. A fixed jobId makes the repeatable-job
// registration idempotent across restarts (BullMQ no-op), same convention as
// the percentile-recalc and cooldown sweeps.
export const DATA_RETENTION_QUEUE = 'data-retention';
export const DATA_RETENTION_JOB_NAME = 'daily-data-retention';
export const DATA_RETENTION_JOB_ID = 'daily-data-retention';
