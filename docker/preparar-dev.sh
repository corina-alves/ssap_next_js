#!/bin/sh
# Inicialização local idempotente; nunca altera produção.
set -eu
cd "$(dirname "$0")/.."
umask 077
mkdir -p secrets/dev
chmod 700 secrets/dev
for nome in postgres_password app_db_password; do
  if [ ! -e "secrets/dev/$nome.txt" ]; then
    openssl rand -hex 32 | tr -d '\n' > "secrets/dev/$nome.txt"
  fi
done
# PostgreSQL (UID 999) e o desenvolvedor têm UIDs distintos. O diretório no
# host é privado; este arquivo só é montado nos serviços que precisam dele.
chmod 644 secrets/dev/app_db_password.txt
if [ ! -e .env.dev ]; then
  cp .env.dev.example .env.dev
  printf '\nDEV_UID=%s\nDEV_GID=%s\n' "$(id -u)" "$(id -g)" >> .env.dev
fi
printf '%s\n' 'Desenvolvimento preparado. Execute:' \
  'docker compose --env-file .env.dev -f compose.dev.yaml up -d --build'
