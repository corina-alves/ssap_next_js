# Docker: desenvolvimento e produção Ubuntu

A aplicação atende em **`/ssap` nos dois ambientes**. O prefixo é compilado pelo Next; mudar a variável de runtime não muda as rotas.

| Ambiente | Arquivo | Banco / proxy | Endereço padrão |
|---|---|---|---|
| Desenvolvimento | `compose.dev.yaml` independente | PostgreSQL local incluído; navegador, dependências e ferramentas incluídos | `http://localhost:3001/ssap` |
| Produção | `compose.yaml` | PostgreSQL e Nginx existentes, fora deste Compose | `https://SEU_DOMINIO/ssap` |

Não combine os dois arquivos Compose. Os projetos e volumes de desenvolvimento e produção são separados. Produção conserva o nome `sala-situacao` e os volumes de arquivos/cache da definição anterior. Nenhum volume de banco existente é removido ou importado automaticamente.

Requisitos: Docker Engine e Compose plugin 2.24+ no Ubuntu, acesso aos registries/npm e às APIs externas. O script inicial de desenvolvimento usa `openssl`. Instalação do Engine: [documentação oficial para Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Não precisa instalar Node no host.

## Desenvolvimento completo

```bash
sh docker/preparar-dev.sh
docker compose --env-file .env.dev -f compose.dev.yaml config --quiet
docker compose --env-file .env.dev -f compose.dev.yaml up -d --build
docker compose --env-file .env.dev -f compose.dev.yaml exec app entrada npm run admin:criar
```

Abra `http://localhost:3001/ssap/acesso`. O script cria `.env.dev` e senhas aleatórias somente em `secrets/dev`, sem sobrescrever arquivos existentes. Configura UID/GID do desenvolvedor no Linux para preservar a propriedade do código. O diretório de segredos é privado; a senha da aplicação no dev é legível pelos dois UIDs que precisam dela (PostgreSQL e desenvolvedor), e só é montada nos serviços autorizados. Senhas de produção usam permissões diferentes, abaixo.

O ambiente inclui PostgreSQL 18, migrações automáticas, Node 24, npm, TypeScript, tsx, testes e Chromium/Playwright para captura de diagramas. O código é montado para recarga automática. `node_modules`, `.next` e cache npm ficam em volumes Linux separados; alteração no lockfile atualiza dependências na próxima inicialização. Após alterar dependências, reinicie o app; após atualizar a versão de Playwright, reconstrua também a imagem para atualizar o Chromium.

```bash
# Verificações e ferramentas (exec não executa entrypoint: use entrada para ler os segredos)
docker compose --env-file .env.dev -f compose.dev.yaml exec app entrada npm test
docker compose --env-file .env.dev -f compose.dev.yaml exec app entrada npm run typecheck
docker compose --env-file .env.dev -f compose.dev.yaml exec app entrada npm run db:migrar
docker compose --env-file .env.dev -f compose.dev.yaml exec app entrada npm run integracoes:testar
docker compose --env-file .env.dev -f compose.dev.yaml exec app entrada npm install NOME_DO_PACOTE
docker compose --env-file .env.dev -f compose.dev.yaml exec db psql -U postgres -d ssap
docker compose --env-file .env.dev -f compose.dev.yaml logs -f app
```

PostgreSQL acessível no host em `127.0.0.1:5433` para DBeaver/psql. Use o usuário `ssap_app`, banco `ssap`, senha de `secrets/dev/app_db_password.txt`. Para rodar Node no host, use `.env.local` com os valores de `.env.example`, URL do banco apontando à porta 5433 e `APP_URL=http://localhost:3000/ssap`. O `.env.local` nunca é incluído na imagem.

Para mudar portas, altere `.env.dev` (`APP_PORTA`, `DB_PORTA_LOCAL` e `APP_URL` juntos). `WATCHPACK_POLLING=true` é opcional para sistemas de arquivos sem eventos de mudança. Não mude o segredo de um banco já inicializado sem alterar também a senha do papel PostgreSQL.

## Produção: configuração e banco existente

Copie `.env.docker.example` para `.env.docker`, mantenha-o com modo 600 e preencha:

- `APP_URL=https://SEU_DOMINIO/ssap`, com HTTPS, sem query, fragmento ou credenciais.
- `DB_HOST`, `DB_PORTA`, `DB_NOME`, `DB_USUARIO` da instância existente. Use um papel próprio sem `SUPERUSER`, `CREATEDB` ou `CREATEROLE`; não use `postgres` para o site.
- `DB_SSL_MODE=verify-full` verifica CA e hostname. Não há opção para ignorar certificados. Para banco no mesmo host em rede local controlada e sem TLS, `disable` é uma escolha explícita do operador.
- `APP_PORTA`, se a porta 3000 já estiver ocupada. A publicação permanece em `127.0.0.1`, destinada ao Nginx no host.

`localhost` dentro do app é o próprio container. Para PostgreSQL no Ubuntu host, existe o alias `host.docker.internal:host-gateway`. O PostgreSQL precisa escutar em um endereço alcançável pela bridge Docker, e `pg_hba.conf` deve autorizar somente a rede/endereço dessa aplicação, banco e papel, usando `scram-sha-256` (ou `hostssl` com TLS). Inspecione a rede com `docker network inspect sala-situacao_aplicacao` após criar o app; preserve as regras existentes e não abra `0.0.0.0/0`. Firewall também precisa permitir esse caminho específico. Se o banco só escuta em `127.0.0.1`, esse alias não resolve a restrição de escuta.

Grave **a senha já existente do papel** em `secrets/app_db_password.txt`, sem colocá-la no terminal, histórico, YAML, build args ou `DATABASE_URL` do `.env.docker`. O diretório deve ser privado. O container roda como UID/GID 1000, portanto prepare a leitura do arquivo:

```bash
mkdir -p secrets
chmod 700 secrets
# Grave a senha existente por editor seguro/gerenciador de segredos, sem imprimi-la.
sudo chown root:1000 secrets/app_db_password.txt
sudo chmod 640 secrets/app_db_password.txt
chmod 600 .env.docker
```

É possível indicar um arquivo externo ao checkout em `DB_SENHA_HOST_ARQUIVO`. Secrets do Compose com origem em arquivo são bind mounts: `uid/gid/mode` declarados no YAML não corrigem a permissão no host. [Docker: secrets e permissões](https://docs.docker.com/reference/compose-file/services/#secrets).

Para CA privada, configure `DB_SSL_CA_ARQUIVO=/certs/postgres-ca.pem` e monte a CA somente leitura em `app` e `ferramentas`; também em `backup`/`restaurar` se usados. A mesma política TLS é aplicada ao pool e às ferramentas. Sem CA específica, Node usa as CAs de confiança e o cliente PostgreSQL de backup usa `sslrootcert=system`. [PostgreSQL: TLS verificado](https://www.postgresql.org/docs/18/libpq-ssl.html).

Exemplo de `compose.override.yaml` para uma CA (repita o mount nos serviços de manutenção):

```yaml
services:
  app:
    volumes:
      - ./deploy/certs/postgres-ca.pem:/certs/postgres-ca.pem:ro
  ferramentas:
    volumes:
      - ./deploy/certs/postgres-ca.pem:/certs/postgres-ca.pem:ro
```

## Produção: construir, migrar e iniciar

Faça backup do banco existente antes de aplicar migrações e confirme que ele é o banco desta aplicação. As migrações usam o schema `public` e criam as tabelas SSAP; uma base compartilhada com tabelas homônimas precisa ser analisada antes. Banco ainda não migrado precisa de permissão DDL para a operação de migração. Para separar usuário migrador e runtime, consulte [SEGURANCA.md](SEGURANCA.md).

```bash
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker build app ferramentas
docker compose --env-file .env.docker run --rm ferramentas npm run db:migrar
# Somente se ainda não houver administrador:
docker compose --env-file .env.docker run --rm ferramentas npm run admin:criar
docker compose --env-file .env.docker up -d app
docker compose --env-file .env.docker ps
curl -fsS http://127.0.0.1:3000/ssap/api/saude
```

Ajuste a porta do curl a `APP_PORTA`. **Produção não executa migrações automaticamente ao subir o site.** `ferramentas` está no perfil de operações, ativado implicitamente ao usar `run ferramentas`. O healthcheck retorna 200 só quando app e banco estão funcionando, e 503 sem detalhes sensíveis se a conexão falhar. Em atualização, pare o app antes de migrar para evitar código antigo com schema novo; inicie-o depois da migração bem-sucedida. Rollback de imagem não desfaz migrações.

## Nginx já existente e `/ssap`

Não suba outro Nginx nem substitua o `server` existente. Revise primeiro o site ativo em `sites-enabled`/`nginx -T`. Os arquivos do projeto são **trechos de referência**, não mudanças aplicadas ao servidor:

1. Instale `deploy/nginx/ssap-proxy.conf` em `/etc/nginx/snippets/ssap-proxy.conf` e ajuste a porta se necessário.
2. Adicione o conteúdo de `deploy/nginx/ssap.conf.template` dentro do `server` HTTPS existente, compatibilizando locations já presentes.
3. Execute `sudo nginx -t`; só então `sudo systemctl reload nginx`.
4. Confirme `curl -fsS https://SEU_DOMINIO/ssap/api/saude` e teste login e envio de PDF pelo navegador.

`proxy_pass http://127.0.0.1:3000;` **não leva barra após a porta**: a URI `/ssap/...` deve chegar intacta ao Next. O trecho cobre `/ssap` e `/ssap/`, mantém streaming, aceita uploads de 32 MB e timeout de 300 segundos. Nginx sobrescreve Host/Forwarded headers e `X-Forwarded-For=$remote_addr`; `TRUST_PROXY=true` só faz sentido com tráfego passando por esse proxy. Se existir balanceador antes do Nginx, configure `real_ip` para os proxies confiáveis reais antes de usar `$remote_addr`. Preservar o prefixo é necessário para links, assets e Server Actions. [Next: basePath](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath).

O location de redefinição desativa access log para evitar registrar o token da URL. Preserve HTTPS e a política HSTS do site existente. Cookies de sessão usam `__Host-`, `Secure`, `HttpOnly`, `SameSite=Strict` e `Path=/` conforme as exigências desse prefixo; login de produção deve ser validado pela URL HTTPS pública.

## Segurança, captura de diagramas e integrações

A imagem final usa standalone, usuário `node`, filesystem somente leitura, volumes de uploads/cache, capabilities removidas, limites de processos/memória e logs rotativos. Segredos/ambientes/dados/histórico Git ficam fora do build context. Não envie segredos em variáveis `NEXT_PUBLIC_*`.

Chromium é necessário para os diagramas dos sumários. A captura usa sandbox, cache de cinco minutos, fila serial/deduplicada e prazo de 75 segundos. `docker/chromium-seccomp.json` deriva do [perfil oficial Playwright v1.64.0](https://github.com/microsoft/playwright/blob/v1.64.0/utils/docker/seccomp_profile.json), acrescido de `chroot` para a sandbox dentro do namespace de usuário. Funciona sem `privileged`, `SYS_ADMIN` ou desligar AppArmor. Um host que proíbe namespaces de usuário precisa de política específica analisada pelo administrador; a aplicação mantém a sandbox e informa falha da captura, sem removê-la automaticamente. [Playwright em Docker](https://playwright.dev/docs/docker).

Credencial opcional SAISP: salve fora do Git, com leitura para UID/GID 1000; acrescente um secret `saisp_password` em override, monte em `app` e defina `SAISP_SENHA_ARQUIVO=/run/secrets/saisp_password`. Não preencha a senha em `.env.docker`. `entrada` a carrega somente em runtime. Proxy de saída/CA corporativa: opções comentadas nos modelos; monte a CA em app/ferramentas, sem desativar verificação HTTPS.

As APIs externas exigem saída HTTPS para SABESP, ANA, SIBH/SSD SP Águas, Open-Meteo, IBGE, SAISP, S3 e IPMet. Falhas do provedor são diferentes de falhas do Docker. O comando `integracoes:testar` mostra a situação atual das fontes.

Achados e limitações da revisão de credenciais, SQL e autenticação: [SEGURANCA.md](SEGURANCA.md).

## Operação e backup

```bash
docker compose --env-file .env.docker logs --tail 200 app
docker compose --env-file .env.docker restart app
docker compose --env-file .env.docker run --rm ferramentas npm run integracoes:testar
docker compose --env-file .env.docker run --rm ferramentas npm run arquivos:banco
# Exibe um token sensível de uso único: execute interativamente, sem enviar a logs.
docker compose --env-file .env.docker run --rm ferramentas npm run senha:link -- LOGIN
```

`restart: unless-stopped` permite reinício com o daemon Docker; no Ubuntu habilite-o com `sudo systemctl enable docker`. Um status unhealthy indica problema, mas Docker Compose não reinicia um container somente por estar unhealthy; use seu monitoramento para alertar.

Se o banco já tem backup institucional, use-o junto com o volume de arquivos. O perfil `manutencao` também inclui clientes `pg_dump`/`pg_restore` 18 para banco existente PostgreSQL 15–18 (servidor mais novo exige cliente compatível). Prepare `backups/` para UID1000 e mantenha cópia fora do servidor:

```bash
mkdir -p backups
sudo chown 1000:1000 backups
chmod 700 backups
docker compose --env-file .env.docker run --rm backup
```

O backup contém banco.dump, arquivos.tar.gz e SHA256SUMS, com arquivos privados. Ao manter o site gravando, o dump é consistente no banco, mas banco e filesystem não constituem uma transação única; pare o app se precisar de um backup coordenado. Retenção é opcional (`BACKUP_MANTER_DIAS`, inteiro positivo). Nunca apague volumes de arquivos/banco com `down -v` ou `docker volume rm`.

Restauração é destrutiva para o banco selecionado; confira `DB_HOST/DB_NOME`, interrompa o app e faça backup novo antes:

```bash
docker compose --env-file .env.docker stop app
docker compose --env-file .env.docker run --rm -e CONFIRMAR=SIM restaurar ssap_AAAAMMDD-HHMMSS
docker compose --env-file .env.docker up -d app
```

`pg_restore` usa uma transação; os arquivos são restaurados depois, portanto os dois recursos não são atômicos. Permissões/triggers/tabelas compartilhadas precisam ser avaliadas antes de qualquer restauração em produção.
