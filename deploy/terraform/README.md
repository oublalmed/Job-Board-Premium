# Terraform — Cobalt promotion (ENF-13)

A thin, stateful wrapper that installs the `../helm/cobalt` chart via the
`helm_release` resource. It adds nothing the chart does not already express — it
just makes the promotion **reproducible** (pinned provider versions) and
**stateful** (Terraform tracks the release), and lets you drive it from CI.

## Prerequisites

- Terraform ≥ 1.5, a reachable Kubernetes cluster, and a kubeconfig.
- The External Secrets Operator installed in the cluster (unless you set
  `externalSecrets.enabled=false` in a values file and provision the Secret
  another way).

## Usage

```bash
terraform init
terraform plan  -var image_tag=$(git rev-parse --short HEAD) -var api_host=api.cobalt.ma
terraform apply -var image_tag=$(git rev-parse --short HEAD) -var api_host=api.cobalt.ma
```

Per-environment configuration: pass full Helm values files through
`values_files` (merged in order, later wins), and pin the common knobs with the
dedicated variables:

```hcl
# prod.tfvars
image_repository = "registry.example.com/cobalt-api"
image_tag        = "1.4.0"
api_host         = "api.cobalt.ma"
replica_count    = 5
values_files     = ["${path.module}/env/prod.values.yaml"]
```

```bash
terraform apply -var-file=prod.tfvars
```

## Variables

| Variable           | Default            | Purpose                                   |
| ------------------ | ------------------ | ----------------------------------------- |
| `kubeconfig`       | `~/.kube/config`   | Path to the kubeconfig file               |
| `kube_context`     | `""`               | kubeconfig context (empty = current)      |
| `release_name`     | `cobalt`           | Helm release name                         |
| `namespace`        | `cobalt`           | Target namespace (created if absent)      |
| `image_repository` | `cobalt-api`       | API image repository                      |
| `image_tag`        | `latest`           | API image tag (use a Git SHA in CI)       |
| `api_host`         | `api.cobalt.example` | Ingress hostname                        |
| `replica_count`    | `3`                | API replicas                              |
| `values_files`     | `[]`               | Extra Helm values files, merged in order  |

## Validation

`terraform fmt -check` and `terraform validate` pass. `validate` does not need a
cluster; `plan`/`apply` do. This module was authored and validated locally; a
live `apply` is the operational step, performed against your target cluster.
