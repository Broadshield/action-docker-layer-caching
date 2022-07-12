#!/usr/bin/env bash
export DOCKER_REGISTRY="ghcr.io"
export CACHE_IMAGE_REGISTRY="${DOCKER_REGISTRY}/${GITHUB_REPOSITORY_OWNER:-Broadshield}"

docker rmi -f b48aa2e90c0a 2>/dev/null || true
IMAGE_ID="${DOCKER_REGISTRY:-localhost:5000}/${GITHUB_REPOSITORY_OWNER:-Broadshield}/${IMAGE_NAME:-node:16-alpine}"
# Change all uppercase to lowercase
IMAGE_ID=$(tr '[:upper:]' '[:lower:]' <<<"${IMAGE_ID}")
docker pull "${IMAGE_ID}"
if [[ -z ${VERSION} ]]; then
  if [[ ${GITHUB_REF_TYPE} == "tag" ]]; then
    VERSION="${GITHUB_REF#*v}"
  elif [[ ${GITHUB_REF_TYPE} == "branch" ]]; then
    VERSION="${GITHUB_REF#refs/heads/}"
  fi
fi
if [[ ${VERSION%%/*} != "" ]]; then
  PREFIX="${VERSION%%/*}_"
fi
PREFIX_LENGTH=${#PREFIX}
VERSION="${VERSION##*/}"
VERSION="${VERSION//[^-._A-Za-z0-9]/_}"
VERSION="$(tr -s '\-_.' <<<"${VERSION}")"
if [[ ${#VERSION} -gt 128 ]]; then
  printf "::error::Version is too long, it must be less than 128 characters:: Crop it to: '%s'\n" "${VERSION:0:128}"
  exit 1
fi
if [[ ${PREFIX_LENGTH} -gt 0 ]] && [[ ${#VERSION} -gt $((128 - PREFIX_LENGTH)) ]]; then
  VERSION="${PREFIX}${VERSION}"
fi

docker tag "${IMAGE_NAME}" "${IMAGE_ID}:${VERSION}"
docker push "${IMAGE_ID}:${VERSION}"
