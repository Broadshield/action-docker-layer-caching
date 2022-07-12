#!/bin/bash
GITHUB_ACTION_PATH="${GITHUB_ACTION_PATH:-$(pwd)}"
echo "::group::Processing GitHub context"
echo "::set-output name=bake-file::${GITHUB_ACTION_PATH}/github-metadata-action.hcl"
echo "Output:"
echo "- bake-file = ${GITHUB_ACTION_PATH}/github-metadata-action.hcl"
echo "::endgroup::"

echo "::group::Bake definition"
echo "- bake-file = ${GITHUB_ACTION_PATH}/github-metadata-action.hcl"
docker buildx bake -f "${GITHUB_ACTION_PATH}/github-metadata-action.hcl" --print github-metadata-action
docker buildx bake -f "${GITHUB_ACTION_PATH}/github-metadata-action.hcl" || true
echo "- bake-file = ${GITHUB_ACTION_PATH}/docker-bake.hcl"
docker buildx bake -f "${GITHUB_ACTION_PATH}/docker-bake.hcl" --print docker-bake
docker buildx bake -f "${GITHUB_ACTION_PATH}/docker-bake.hcl" || true
echo "::endgroup::"
