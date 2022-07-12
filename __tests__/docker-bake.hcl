// docker-bake.hcl
target "docker-metadata-action" {}
target "github-metadata-action" {}

target "build" {
  inherits = ["docker-metadata-action", "github-metadata-action"]
  context = "./test_project"
  dockerfile = "Dockerfile"
  platforms = [
    "linux/amd64",
    "linux/arm/v6",
    "linux/arm/v7",
    "linux/arm64",
    "linux/386"
  ]
}
