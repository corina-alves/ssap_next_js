#!/bin/sh
# Atualiza o volume de dependências quando package-lock.json muda.
set -eu
atual="$(sha256sum package-lock.json | cut -d ' ' -f 1)"
instalado="$(cat node_modules/.ssap-lock.sha256 2>/dev/null || true)"
if [ "$atual" != "$instalado" ]; then
  npm ci --no-audit --no-fund
  printf '%s\n' "$atual" > node_modules/.ssap-lock.sha256
fi
exec "$@"
