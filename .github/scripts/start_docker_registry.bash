#!/usr/bin/env bash
export DOCKER_BUILDKIT=1
export REGISTRY_REDIS_PASSWORD="SomePa${RANDOM}ss"
export REDIS_PASSWORD="${REGISTRY_REDIS_PASSWORD}"
mutagen-compose -f ".github/scripts/compose.yml" down
#
if [[ -n ${CI:+x} ]]; then
  sudo sysctl vm.overcommit_memory=1 2>/dev/null || true
fi
mutagen-compose -f ".github/scripts/compose.yml" up -d --remove-orphans && \
  mutagen-compose -f ".github/scripts/compose.yml" exec -it registry-redis redis-cli save
mutagen-compose -f ".github/scripts/compose.yml" logs --follow &
