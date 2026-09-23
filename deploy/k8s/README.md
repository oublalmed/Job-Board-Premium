# Deploy scaffolding (example)

Starting-point Kubernetes manifests for the Cobalt API. These are **examples**
to adapt, not a turnkey production deployment — see `docs/HARDENING.md` for the
non-functional requirements they help satisfy (ENF-03 horizontal scale, ENF-13
IaC, ENF-05 TLS in transit).

- `api.yaml` — Deployment (3 replicas, stateless), Service, and a TLS Ingress,
  with split liveness (`/health/live`) and readiness (`/health/ready`) probes.
- `db-backup.yaml` — ENF-08: nightly `pg_dump` CronJob streaming a gzipped dump
  to object storage (managed Postgres PITR still recommended over this).
- `external-secrets.yaml` — ENF-07: External Secrets Operator `SecretStore` +
  `ExternalSecret` that materialise `cobalt-secrets` from a cloud secret
  manager, so no secret value is committed here or stored in plaintext config.

Secrets (`cobalt-secrets`) are provisioned by `external-secrets.yaml` (or any
equivalent) — never committed here.

Promote to Helm/Terraform for real environments.
