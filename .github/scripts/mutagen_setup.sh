#!/bin/bash
if command -v mutagen 2>/dev/null; then

brew install mutagen-io/mutagen/mutagen-beta
brew install mutagen-io/mutagen/mutagen-compose
fi
mutagen daemon start

cat <<EOF > docker-compose.mutagen.yml
x-mutagen:
  sync:
    defaults:
      ignore:
        vcs: true
      mode: "two-way-resolved"
  forward:
    jupyter:
      source: "tcp:localhost:5000"
      destination: "network://default:tcp:registry:5000"
    mount-code:
      alpha: "."
      beta: "volume://mount-code"
EOF
