terraform {
  required_version = ">= 1.5.0"

  required_providers {
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.13"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.31"
    }
  }
}

provider "kubernetes" {
  config_path    = var.kubeconfig
  config_context = var.kube_context
}

provider "helm" {
  kubernetes {
    config_path    = var.kubeconfig
    config_context = var.kube_context
  }
}

# ENF-13 — promote the Cobalt Helm chart across environments. The chart lives
# at ../helm/cobalt; per-environment configuration comes from var.values_files
# plus the targeted overrides below. This wrapper adds nothing the chart does
# not already express — it just makes the promotion reproducible and stateful.
resource "helm_release" "cobalt" {
  name             = var.release_name
  namespace        = var.namespace
  create_namespace = true

  chart = "${path.module}/../helm/cobalt"

  # Full values files, merged in order (later files win).
  values = [for f in var.values_files : file(f)]

  set {
    name  = "image.repository"
    value = var.image_repository
  }

  set {
    name  = "image.tag"
    value = var.image_tag
  }

  set {
    name  = "ingress.host"
    value = var.api_host
  }

  set {
    name  = "replicaCount"
    value = var.replica_count
  }
}
