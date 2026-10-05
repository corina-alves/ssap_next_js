#!/bin/sh
# Roda só na PRIMEIRA subida do contêiner do PostgreSQL (volume vazio).
# Cria o usuário da aplicação, sem superusuário, dono apenas do banco da Sala.
set -eu
: "${APP_DB_USER:?defina APP_DB_USER}"
: "${APP_DB_PASSWORD:?defina APP_DB_PASSWORD}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v usuario="$APP_DB_USER" -v senha="$APP_DB_PASSWORD" -v banco="$POSTGRES_DB" <<'SQL'
CREATE ROLE :"usuario" LOGIN PASSWORD :'senha' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER DATABASE :"banco" OWNER TO :"usuario";
REVOKE ALL ON DATABASE :"banco" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"banco" TO :"usuario";
SQL
