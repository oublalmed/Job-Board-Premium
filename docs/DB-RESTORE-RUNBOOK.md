# Database restore runbook (ENF-08)

Backups only count once a **restore has been proven**. This runbook makes the
restore drill turnkey; running it on your infrastructure and recording the
result in the log below is what closes ENF-08 to 100% (the run itself is an
operational step — it needs the real backup target and database).

Two layers exist:

- **Logical backup** — the nightly `pg_dump` CronJob (`deploy/k8s/db-backup.yaml`,
  or the Helm chart's `backup.*`) streams a gzipped dump to object storage.
  Good for a full restore to a fresh database; **coarse RPO** (up to 24h loss).
- **PITR (point-in-time recovery)** — continuous WAL archiving, so you can
  restore to any second. This is a **managed-Postgres / pgBackRest** capability,
  not something the CronJob provides. Strongly recommended for production.

## A. Enable PITR (managed Postgres — recommended)

PITR is a hosting setting, not app code. Enable it on the managed service and
record the retention window:

- **AWS RDS/Aurora** — automated backups on, `BackupRetentionPeriod` ≥ 7 days;
  PITR via "Restore to point in time".
- **GCP Cloud SQL** — automated backups + **point-in-time recovery** enabled
  (binary logging / WAL); restore via "Clone" to a timestamp.
- **Azure Database for PostgreSQL (Flexible)** — geo/redundant backups,
  `backup_retention_days` ≥ 7; "Restore" to a timestamp.
- **Self-managed** — pgBackRest or WAL-G archiving WAL to object storage.

## B. Restore drill — logical dump (works today, no managed service)

Run in a **non-production** namespace/instance. `DATABASE_URL` here must point at
the **empty restore target**, never production.

```bash
# 1. Pull the dump to restore (pick the object to test).
aws s3 cp "s3://$BACKUP_BUCKET/2026/09/28/cobalt-2026-09-28T021500Z.sql.gz" ./restore.sql.gz

# 2. Restore into a fresh database.
gunzip -c ./restore.sql.gz | psql "$RESTORE_DATABASE_URL"

# 3. Sanity-check row counts on a few core tables.
psql "$RESTORE_DATABASE_URL" -c "select
  (select count(*) from users)                as users,
  (select count(*) from candidate_profiles)   as profiles,
  (select count(*) from subscriptions)         as subscriptions,
  (select count(*) from invoices)              as invoices;"

# 4. Point a throwaway API instance at RESTORE_DATABASE_URL and smoke-test
#    /api/v1/health/ready plus a login. Then tear the restore target down.
```

## C. Restore drill — PITR (managed service)

1. In the managed console/CLI, restore to a timestamp ~5 min in the past into a
   **new** instance.
2. Run the step-3 row-count check and the step-4 smoke test against it.
3. Record the wall-clock **RTO** (how long the restore took) and the achieved
   **RPO** (data-loss window) below.

## Acceptance / cadence

- Run drill **B** at least quarterly; run **C** once PITR is enabled, then quarterly.
- A drill passes when: restore completes, row counts are plausible, and the API
  reaches `/health/ready` and serves a login against the restored data.

## Drill log

| Date | Operator | Method (B/C) | Source backup / timestamp | RTO | RPO | Result | Notes |
|------|----------|--------------|---------------------------|-----|-----|--------|-------|
|      |          |              |                           |     |     |        |       |

> ENF-08 stays **60 %** until PITR is enabled **and** a restore drill row above
> passes. The CronJob (logical backup) and this runbook are the repo's half; the
> managed PITR + the drill run are the operational half.
