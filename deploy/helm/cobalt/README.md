# Cobalt Helm chart (ENF-13)

Helm packaging of the `deploy/k8s/*.yaml` example manifests, so real
environments get a parameterised, versioned promotion instead of hand-edited
YAML. The chart is **cloud-agnostic**: the secret-manager provider and the
backup target are values, never hard-coded in the templates.

## What it renders

| Template                 | Resource(s)                       | ENF |
| ------------------------ | --------------------------------- | --- |
| `deployment.yaml`        | Deployment (3 replicas, probes)   | 03  |
| `service.yaml`           | Service                           | —   |
| `ingress.yaml`           | TLS Ingress                       | 05  |
| `serviceaccount.yaml`    | ServiceAccount (IRSA/WI auth)     | 07  |
| `externalsecret.yaml`    | SecretStore + ExternalSecret      | 07  |
| `db-backup-cronjob.yaml` | nightly `pg_dump` CronJob         | 08  |

Toggle the optional pieces with `ingress.enabled`, `externalSecrets.enabled`,
`backup.enabled`, `serviceAccount.create`.

## Usage

```bash
helm lint deploy/helm/cobalt
helm template cobalt deploy/helm/cobalt          # render to stdout
helm upgrade --install cobalt deploy/helm/cobalt \
  --namespace cobalt --create-namespace \
  --set image.tag=$(git rev-parse --short HEAD) \
  --set ingress.host=api.cobalt.ma
```

Prefer a full values file per environment:

```bash
helm upgrade --install cobalt deploy/helm/cobalt -n cobalt -f env/prod.values.yaml
```

## Switching secret-manager provider

`externalSecrets.secretStore.provider` is passed through to `spec.provider`
verbatim, so `aws` / `gcpsm` / `vault` / `azurekv` all work with no template
change. Helm deep-merges values, so to switch away from the AWS default in an
overriding file, null the `aws` key:

```yaml
externalSecrets:
  secretStore:
    provider:
      aws: null
      gcpsm:
        projectID: my-project
```

## Validation

`helm lint` reports 0 failures (one cosmetic "icon recommended" INFO), and
`helm template` renders all resources for the default values and for the
toggles/provider-swap above. Installing to a live cluster is the operational
step.
