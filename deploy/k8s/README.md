# Deploy scaffolding (example)

Starting-point Kubernetes manifests for the Cobalt API. These are **examples**
to adapt, not a turnkey production deployment — see `docs/HARDENING.md` for the
non-functional requirements they help satisfy (ENF-03 horizontal scale, ENF-13
IaC, ENF-05 TLS in transit).

- `api.yaml` — Deployment (3 replicas, stateless), Service, and a TLS Ingress.
- Backups (ENF-08) are documented as a CronJob example in `docs/HARDENING.md`.

Secrets (`cobalt-secrets`) are expected to be provisioned out-of-band (e.g. via
External Secrets Operator, ENF-07) — never committed here.

Promote to Helm/Terraform for real environments.
