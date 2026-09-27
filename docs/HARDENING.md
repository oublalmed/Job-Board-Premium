# Production hardening (Lot 9 / non-functional requirements)

This document tracks the remaining **non-functional** CDC requirements (§10)
that are operational rather than pure application code. Each item states what
already exists in the codebase, what is still needed, and concrete guidance so
the work can be picked up directly. Application-level gaps (audit-log read,
percentile recalc, MFA, hot-path indexes, PG TLS) have already been closed in
code; the items below depend on the target infrastructure and are documented
here rather than hard-coded to a specific hosting choice.

Status legend: ✅ done in code · 🟡 partial / configurable · ⬜ not started.

---

## ENF-05 — Encryption in transit / at rest 🟡

- **In transit (app → Postgres):** ✅ supported. Set `DB_SSL=true`
  (and `DB_SSL_REJECT_UNAUTHORIZED=true` with a proper CA) — wired in
  `database.config.ts`, `app.module.ts` and `data-source.ts`.
- **In transit (clients → app):** terminate TLS at the ingress/load balancer
  (see the k8s example below); `helmet()` already sets HSTS.
- **At rest:** enable volume/disk encryption at the infrastructure layer
  (RDS "encryption at rest", or an encrypted PV). MFA secrets are additionally
  encrypted at the application layer (AES-256-GCM, `secret-box.ts`).

## ENF-06 — MFA for staff ✅

TOTP MFA is implemented end-to-end (`auth/mfa.service.ts`, `common/crypto/`).
To enforce it for staff in production:

1. Have every admin/moderator enroll (`POST /auth/mfa/setup` → `enable`).
2. Set `MFA_ENFORCE_STAFF=true`. `StaffMfaGuard` then requires an
   MFA-authenticated session for staff-only routes. Do **not** enable before
   enrollment or staff will be locked out.
3. Set a dedicated `MFA_ENCRYPTION_KEY` (32+ bytes of entropy) rather than
   deriving it from the refresh secret.

## ENF-07 — Secrets management 🟡

Env vars are validated (Joi) and `.env` is gitignored. An example External
Secrets Operator manifest is now provided at
`deploy/k8s/external-secrets.yaml` (a `SecretStore` + `ExternalSecret` that
materialise the `cobalt-secrets` Secret from AWS Secrets Manager / GCP Secret
Manager / Vault), so no secret value lives in plaintext Git or config. No
application change is required — the app already reads everything from the
environment. Remaining, host-side: provision the cloud secret manager and its
access (prefer IRSA / workload identity over static keys).

## ENF-08 — Database backups + PITR 🟡

Prefer a managed Postgres with automated backups + point-in-time recovery
(RDS/Cloud SQL: enable automated backups, 7–30 day retention, and test a
restore quarterly). For self-managed Postgres, a nightly logical dump manifest
is now provided at `deploy/k8s/db-backup.yaml` (a `CronJob` that streams a
gzipped `pg_dump` to KMS-encrypted object storage; retention via a bucket
lifecycle rule, documented inline).

PITR itself (WAL archiving) is a managed-service feature; the logical dump is a
floor, not a substitute for it. Remaining, host-side: enable PITR/WAL archiving
and run a periodic restore drill.

## ENF-09 — Observability ⬜

Present: structured business audit trail (now also readable via
`/admin/audit-logs`) and a `/health` endpoint (`@nestjs/terminus`). Missing:
ops metrics/tracing. Recommended, in order of value:

1. **Metrics:** add `prom-client`, expose `/metrics`, scrape with Prometheus.
   Track request latency histograms (feeds the p95 target, ENF-01), queue
   depth for the BullMQ jobs, and DB pool saturation.
2. **Logs:** ship stdout (already structured by Nest's logger) to a central
   store (Loki / CloudWatch / Datadog).
3. **Tracing:** OpenTelemetry SDK + OTLP exporter for cross-service spans.

## ENF-01 — Performance (p95 < 400 ms) 🟡

The hottest read path (CVthèque `indexed_in_cvtheque + visibility` gate) is now
indexed. Still needed: a load test to *measure* p95 (e.g. k6 against
`/search/candidates` with a seeded dataset) and wire it into CI as a
non-blocking nightly job. Add indexes reactively for any query the load test
shows scanning.

## ENF-03 / ENF-13 — Horizontal scale, IaC 🟡

The app is stateless (JWT, no server session; shared Redis for BullMQ), so it
scales horizontally behind a load balancer. The raw example manifests in
`deploy/k8s/` (Deployment + Service + TLS Ingress) are now packaged for real
environments:

- **`deploy/helm/cobalt`** — a cloud-agnostic Helm chart templating all of the
  manifests with a `values.yaml`. Verified: `helm lint` (0 failures) and
  `helm template` render cleanly, including the toggles and secret-manager
  provider swap (aws/gcpsm/vault/azurekv).
- **`deploy/terraform`** — a Terraform module that installs the chart via
  `helm_release` for stateful, reproducible promotion from CI. Verified:
  `terraform fmt -check` and `terraform validate` pass.

Remaining is operational: a live `apply` against the target cluster, and a
500-VU load run on the multi-replica Deployment to evidence ENF-03 on
prod-type infra.

## ENF-12 — Consent capture + data retention 🟡

Data access/erasure are implemented and audited, CNDP/RGPD consent is captured
at sign-up (`RegisterDto.consentAccepted` + `users.consent_at`, `/privacy`
page), and a daily retention sweep (`DataRetentionService`, BullMQ repeatable
at `DATA_RETENTION_CRON`) purges transient records past their window. Records
with a legal or product retention obligation are deliberately never touched.

Retention matrix (windows configurable via env — see `business.config.ts`):

| Data category | Table | Policy | Window (default) |
| --- | --- | --- | --- |
| Read notifications | `notifications` | purge read rows past the window (unread never purged) | `NOTIFICATION_RETENTION_DAYS` (90d) |
| Dead refresh tokens | `refresh_tokens` | purge revoked/expired past the window; live sessions kept regardless of age | `REFRESH_TOKEN_RETENTION_DAYS` (30d) |
| Profile-view cooldowns | `profile_view_cooldowns` | purge stale anti-spam rows (the 24h claim window is long gone; removal is inert) | `PROFILE_VIEW_COOLDOWN_RETENTION_DAYS` (30d) |
| Webhook idempotency markers | `processed_webhook_events` | purge past the payment provider's redelivery horizon | `WEBHOOK_EVENT_RETENTION_DAYS` (90d) |
| Profile-view audit trail | `candidate_profile_views` | **kept** — EF-GROW-04 audit trail, never deleted by design | — |
| Audit log | `audit_logs` | **kept** — security/compliance | — |
| Invoices | `invoices` | **kept** — legal 10-year retention (ADR-0003) | — |
| Data requests | `data_requests` | **kept** — RGPD proof-of-processing | — |

Remaining is operational/DPO: ratify the window durations for the full data
catalogue and sign off the matrix.

## EF-CAND-03 — Antivirus scanning of uploads 🟡

Candidate uploads (CV, diploma) are scanned through the `FileScanner` port
before they are trusted. The bound adapter is chosen at boot by
`ANTIVIRUS_DRIVER` (see `PortsModule.fileScannerFactory`):

- `stub` (**default**) — `StubFileScannerAdapter`, always reports clean. Keeps
  CI, local and dev behavior unchanged with no daemon to run.
- `clamav` — `ClamavFileScannerAdapter`, streams each upload to a ClamAV
  `clamd` daemon over TCP using the INSTREAM protocol (Node's built-in `net`
  socket, no extra dependency). An `OK` reply passes, a `FOUND` reply is
  rejected with the signature name, and an `ERROR`/empty reply is treated as a
  scan failure (thrown), never a silent pass.

Environment variables:

| Var | Default | Meaning |
| --- | --- | --- |
| `ANTIVIRUS_DRIVER` | `stub` | `stub` or `clamav`. Leave `stub` unless a clamd daemon is reachable. |
| `CLAMAV_HOST` | `localhost` | Hostname/IP of the clamd daemon (only used when driver is `clamav`). |
| `CLAMAV_PORT` | `3310` | clamd TCP port (only used when driver is `clamav`). |

To enable in production: run `clamav-daemon` (with `freshclam` keeping
signatures current) reachable from the API pods, then set
`ANTIVIRUS_DRIVER=clamav` and point `CLAMAV_HOST`/`CLAMAV_PORT` at it. clamd's
`StreamMaxLength` must be ≥ the max upload size (`MAX_CV_SIZE_BYTES`).
