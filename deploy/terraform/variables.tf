variable "kubeconfig" {
  description = "Path to the kubeconfig file."
  type        = string
  default     = "~/.kube/config"
}

variable "kube_context" {
  description = "kubeconfig context to target (empty string = current context)."
  type        = string
  default     = ""
}

variable "release_name" {
  description = "Helm release name."
  type        = string
  default     = "cobalt"
}

variable "namespace" {
  description = "Namespace to deploy into (created if absent)."
  type        = string
  default     = "cobalt"
}

variable "image_repository" {
  description = "Container image repository for the API."
  type        = string
  default     = "cobalt-api"
}

variable "image_tag" {
  description = "Container image tag (e.g. a Git SHA)."
  type        = string
  default     = "latest"
}

variable "api_host" {
  description = "Public hostname for the API Ingress."
  type        = string
  default     = "api.cobalt.example"
}

variable "replica_count" {
  description = "Number of API replicas."
  type        = number
  default     = 3
}

variable "values_files" {
  description = "Extra Helm values files (paths), merged in order after the chart defaults."
  type        = list(string)
  default     = []
}
