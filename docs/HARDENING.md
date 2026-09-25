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

## ENF-03 / ENF-13 — Horizontal scale, IaC ⬜

The app is stateless (JWT, no server session; shared Redis for BullMQ), so it
scales horizontally behind a load balancer. Example Kubernetes manifest lives
in `deploy/k8s/` as a starting point (Deployment + Service + Ingress with TLS).
Promote to Terraform/Helm for real environments.

## ENF-12 — Consent capture at registration ⬜

Data access/erasure are implemented and audited. Still missing: explicit
CNDP/RGPD consent capture at sign-up and a per-data-type retention policy.
Small, well-scoped follow-up:

- Add a required `consentAccepted: boolean` (must be `true`) to `RegisterDto`
  and persist a `consentAt` timestamp on `User`.
- Add a consent checkbox with a privacy-policy link to the register page.
- Document retention windows per data category (profiles, CVs, audit logs,
  invoices — invoices already have a legal 10-year retention, see ADR-0003).

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
