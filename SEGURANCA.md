# Revisão de segurança — 13/10/2026

Escopo: configuração do servidor, PostgreSQL, autenticação, redefinição de senha,
Server Actions, rotas JSON, uploads, scripts administrativos e histórico Git local.
As verificações com banco usaram exclusivamente o PostgreSQL de desenvolvimento
criado para esta revisão. Nenhum banco ou proxy de produção foi acessado ou alterado.

## Achados e correções

| Achado | Correção |
| --- | --- |
| Links sensíveis aceitavam `Host`/`X-Forwarded-Host` e protocolo encaminhado para gerar a URL de redefinição. | URL pública canônica obrigatória em produção: `APP_URL=https://DOMINIO/ssap`. Links de senha não usam cabeçalhos da requisição. |
| Sem proxy confiável, o bloqueio por IP aceitava `X-Forwarded-For` enviado pelo cliente. | Cabeçalhos de IP são ignorados com `TRUST_PROXY=false`. Com `true`, usa-se somente o último IP válido acrescentado/sobrescrito pelo proxy controlado. IP desconhecido mantém limitação por conta, sem bloquear todos os usuários juntos. |
| API de captura de Tietê/Pinheiros aceitava permissão em qualquer sala dos sumários. | Cada captura e sua imagem exigem permissão nas salas específicas daquele sumário. |
| Gerações simultâneas de links de senha podiam deixar mais de um token válido. | Transação e bloqueio da linha do usuário serializam geração/consumo; conta inativa/excluída é novamente conferida. |
| Erros completos do PostgreSQL/API podiam ser enviados aos logs; rejeições não capturadas chegavam ao logger do Next com valores de linha em `detail`. | A fronteira central do banco elimina mensagens, valores, SQL, `cause` e `constraint` do driver antes de propagar erros. Mantém SQLSTATE/códigos técnicos usados nas validações, inclusive consultas diretas, transações e callbacks. Logs explícitos guardam códigos; scripts mostram mensagens operacionais aprovadas. |
| O token da redefinição na query podia ser enviado como Referer para scripts/assets do mesmo domínio. | Header e metadata da página aplicam `Referrer-Policy: origin`, omitindo query/caminho sem impedir a Server Action. O exemplo do Nginx desativa access log nessa rota sensível. |
| Aplicação e script de migração não compartilhavam uma política explícita de TLS/timeout do PostgreSQL. | `src/lib/db-config.ts` centraliza conexão. Produção verifica certificado/hostname por padrão; `DB_SSL_CA_ARQUIVO` aceita CA privada. `DB_SSL_MODE=disable` é uma opção explícita para conexão local/rede protegida sem TLS. |
| Parâmetros SSL da URL podem substituir a política TLS do driver. | `DATABASE_URL` rejeita parâmetros `ssl*`/`uselibpqcompat`; use somente `DB_SSL_MODE` e `DB_SSL_CA_ARQUIVO`. |
| Script Windows passava a senha do usuário da aplicação nos argumentos `psql -v`, visíveis na lista de processos. | Senha recebida por variável de ambiente e `\getenv` via entrada padrão; variável removida ao finalizar. O inicializador Docker aplica o mesmo princípio. |
| Falha de rede no rollback podia ocultar o erro original e devolver uma conexão defeituosa ao pool. | O erro original é preservado e a conexão é descartada se o rollback falhar. |

A configuração TLS segue a [documentação oficial do node-postgres](https://node-postgres.com/features/ssl).
Os guias de segurança, variáveis de ambiente e cookies da versão instalada do Next
foram consultados em `node_modules/next/dist/docs/` antes das alterações.

## Senhas e outros segredos

Foram examinados os arquivos atuais e os blobs textuais dos 17 commits disponíveis
no histórico local, procurando URLs PostgreSQL com senha, atribuições de credenciais
e chaves privadas. Não foi identificada credencial real de produção nesses padrões.
Havia senhas/defaults locais de desenvolvimento e credenciais fictícias de build
nas definições antigas. Os segredos de execução agora são gerados/configurados em
arquivos ignorados pelo Git e pelo contexto Docker; não entram em build arguments.
Os valores examinados não foram impressos durante a revisão.

As senhas de usuários são armazenadas com Argon2id. Sessões e links de redefinição
guardam hashes dos tokens, com expiração e revogação. O cookie de produção usa
`Secure`, `HttpOnly`, `SameSite=Strict` e prefixo `__Host-`; `Path=/` é obrigatório
para esse prefixo e foi preservado. O prefixo da aplicação continua `/ssap`.

`npm run senha:link` exibe intencionalmente um token de uso único para entrega pelo
operador. Execute em terminal privado e não capture essa saída em logs públicos.
Reescrever arquivos atuais não apaga os defaults antigos do histórico Git. Se
alguma credencial de desenvolvimento tiver sido reutilizada fora desse ambiente,
substitua a credencial naquele serviço.

Esta busca não comprova ausência absoluta de segredos em formatos não reconhecidos,
refs indisponíveis, cópias externas, backups ou infraestrutura existente.

## SQL Injection e autorização

Não foi encontrada falha significativa de SQL Injection nas consultas examinadas.
Dados de formulário, login, filtros, IDs, datas e JSON são enviados como parâmetros
`$1`, `$2`, etc. A composição dinâmica de filtros contém fragmentos definidos pelo
código e índices de parâmetros; nomes de tabelas/colunas não vêm de entrada do usuário.
Migrações executam SQL dos arquivos versionados locais, não SQL recebido pela web.
O script Windows usa as formas de escape de literal/identificador do `psql`.

As Server Actions de escrita conferem usuário/permissão no servidor, e os downloads
restritos conferem autorização antes de abrir o arquivo. Uploads verificam tamanho,
extensão permitida e assinatura; arquivos ficam fora da pasta pública.

Para o banco preexistente de produção, use usuário próprio sem `SUPERUSER`,
`CREATEDB` ou `CREATEROLE`. Quando possível, mantenha o papel de migração/DDL
separado do papel de execução. O papel que possui uma tabela pode desativar triggers,
inclusive o da auditoria; a aplicação de desenvolvimento é proprietária das tabelas
para permitir migrações locais. Nenhum grant remoto foi modificado nesta revisão.

O DBA deve preparar o papel migrador como proprietário das tabelas e conceder ao
papel runtime somente uso do schema, consultas/mutações nas tabelas da aplicação
e uso das sequências, sem propriedade ou DDL. Auditoria precisa apenas de
`SELECT`/`INSERT`, e `schema_migrations` não precisa de escrita pelo runtime.
Para executar as migrações com esse papel, mantenha a configuração de runtime em
`.env.docker` e use um segredo separado, privado e legível pelo UID 1000:

```sh
docker compose --env-file .env.docker run --rm \
  -e DB_USUARIO=ssap_migrador \
  -e DB_SENHA_ARQUIVO=/run/secrets/senha_migracao \
  -v "$(pwd)/secrets/senha_migracao.txt:/run/secrets/senha_migracao:ro" \
  ferramentas npm run db:migrar
```

O exemplo pressupõe banco/schema dedicados à SSAP, papéis e grants já preparados
pelo DBA. Não transfere propriedade de tabelas de um banco compartilhado nem aplica
grants automaticamente. A senha não entra na linha de comando.

## Evidências de validação

- Os onze testes de `tests/security.test.ts` passaram: URL pública, mensagens sem
  senha, política TLS, links `/ssap`, confiança no IP, erro do driver, parâmetros SQL
  em consultas reais administrativas/públicas/login, proteção das APIs Promise/callback
  do driver e descarte após rollback com falha.
- No PostgreSQL local, quatro gerações concorrentes deixaram um único token válido.
  Duas redefinições concorrentes tiveram exatamente um sucesso; o hash da nova senha
  conferiu, as sessões foram revogadas e o replay/conta inativa foram recusados.
- Payload contendo aspas, `OR 1=1` e `DROP TABLE` em filtros administrativos,
  boletins públicos e documentos públicos não retornou registros nem alterou a tabela.
- Um erro real de CHECK PostgreSQL (`23514`) cujo `detail` continha um valor sensível
  foi sanitizado em `query()`, consulta direta do pool, transação e callback. Nenhum
  registro foi inserido; o pool continuou saudável depois da rejeição.
- `npm run typecheck -- --incremental false` passou no ambiente Docker de desenvolvimento.
- O usuário temporário dessa verificação foi removido; o evento de redefinição
  permanece na auditoria local, com `usuario_id` nulo, conforme a política do banco.

- A suíte completa passou com 78 testes; npm audit da árvore completa retornou zero advisories conhecidos.
- Produção foi construída e validada com PostgreSQL local externo ao Compose e Nginx HTTPS isolado: login, cookie seguro, CSRF, assets/PDFs e entrada `/ssap` responderam como esperado.
- Redefinição real no navegador definiu senha e consumiu o token; 42 requisições ficaram sem token em Referer, mantendo Origin e a Server Action funcionando.
- A senha de teste literal/codificada não apareceu no bundle, imagem, histórico de imagem ou configuração dos containers.

Os testes locais não validam o certificado, as permissões ou os cabeçalhos do Nginx
já existente no servidor Ubuntu. Configure os valores reais e siga as verificações
de implantação descritas em `DOCKER.md`.
