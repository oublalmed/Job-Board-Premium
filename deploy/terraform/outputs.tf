output "release_name" {
  description = "The deployed Helm release name."
  value       = helm_release.cobalt.name
}

output "release_namespace" {
  description = "Namespace the release was deployed into."
  value       = helm_release.cobalt.namespace
}

output "release_status" {
  description = "Status of the Helm release."
  value       = helm_release.cobalt.status
}

output "chart_version" {
  description = "Version of the chart that was deployed."
  value       = helm_release.cobalt.version
}
