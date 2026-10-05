# syntax=docker/dockerfile:1
# Sala de Situação — imagem de produção (Next.js standalone).
#
#   docker compose up -d --build        (veja docker-compose.yml)
#
# Etapas:
#   deps        dependências completas (npm ci)
#   ferramentas código + dependências completas: migrações e scripts (tsx)
#   build       next build → .next/standalone
#   app         imagem final: só o necessário para rodar, usuário sem privilégios

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS ferramentas
COPY . .
ENV NODE_ENV=production
# Sem CMD: o compose define o comando (npm run db:migrar, npm run admin:criar).

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# O build não conecta no banco; a variável só precisa ter formato válido.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build npm run build

FROM node:${NODE_VERSION}-bookworm-slim AS app
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    STORAGE_DIR=/dados/storage \
    CACHE_DIR=/dados/cache

RUN mkdir -p /dados/storage /dados/cache && chown -R node:node /dados
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node
EXPOSE 3000
VOLUME ["/dados/storage", "/dados/cache"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
