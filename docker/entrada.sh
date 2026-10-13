#!/bin/sh
# Ponto de entrada dos contêineres da aplicação.
# A senha do banco chega como segredo (arquivo), não como variável de ambiente:
# aqui ela vira DATABASE_URL só dentro do processo. Se DATABASE_URL já estiver
# definida, nada é alterado.
set -eu
umask 027

if [ -z "${DATABASE_URL:-}" ] && [ -n "${DB_SENHA_ARQUIVO:-}" ]; then
  if [ ! -r "$DB_SENHA_ARQUIVO" ]; then
    echo "entrada: segredo da senha do banco não encontrado em $DB_SENHA_ARQUIVO" >&2
    exit 1
  fi
  # node monta o endereço para a senha poder ter qualquer caractere
  DATABASE_URL="$(node -e '
    const fs = require("node:fs");
    const senha = fs.readFileSync(process.env.DB_SENHA_ARQUIVO, "utf8").replace(/[\r\n]+$/, "");
    if (!senha) { console.error("entrada: o segredo da senha do banco está vazio"); process.exit(1); }
    const host = process.env.DB_HOST;
    const porta = process.env.DB_PORTA || "5432";
    if (!host || !/^(?:[a-zA-Z0-9_.-]+|\[[0-9a-fA-F:]+\])$/.test(host) || !/^\d+$/.test(porta) || +porta < 1 || +porta > 65535) {
      console.error("entrada: DB_HOST ou DB_PORTA inválidos"); process.exit(1);
    }
    const e = encodeURIComponent;
    process.stdout.write(`postgres://${e(process.env.DB_USUARIO || "ssap_app")}:${e(senha)}@${host}:${porta}/${e(process.env.DB_NOME || "ssap")}`);
  ')"
  export DATABASE_URL
fi

# Credencial opcional do radar: mesmo mecanismo de arquivo, nunca build arg.
if [ -n "${SAISP_SENHA_ARQUIVO:-}" ]; then
  if [ ! -r "$SAISP_SENHA_ARQUIVO" ]; then
    echo 'entrada: segredo SAISP não encontrado ou sem permissão de leitura' >&2
    exit 1
  fi
  SAISP_SENHA="$(node -e 'process.stdout.write(require("node:fs").readFileSync(process.env.SAISP_SENHA_ARQUIVO,"utf8").replace(/[\r\n]+$/, ""))')"
  export SAISP_SENHA
fi

exec "$@"
