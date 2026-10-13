# syntax=docker/dockerfile:1
ARG NODE_VERSION=24.21.0
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    TZ=America/Sao_Paulo \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
WORKDIR /app
COPY docker/entrada.sh /usr/local/bin/entrada
COPY docker/dev-comando.sh /usr/local/bin/dev-comando
RUN sed -i 's/\r$//' /usr/local/bin/entrada /usr/local/bin/dev-comando \
 && chmod 755 /usr/local/bin/entrada /usr/local/bin/dev-comando \
 && mkdir -p /dados/storage /dados/cache \
 && chown -R node:node /dados
ENTRYPOINT ["entrada"]

FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund \
 && sha256sum package-lock.json | cut -d ' ' -f 1 > node_modules/.ssap-lock.sha256

# Chromium é usado pela captura dos diagramas e pelos testes de navegador.
# O mount empresta a CLI sem carregar dependências de build na imagem final.
FROM base AS navegador
RUN --mount=type=bind,from=deps,source=/app/node_modules,target=/tmp/node_modules \
    node /tmp/node_modules/playwright/cli.js install --with-deps --only-shell chromium \
 && rm -rf /var/lib/apt/lists/*

FROM deps AS ferramentas
COPY . .
ENV NODE_ENV=production \
    STORAGE_DIR=/dados/storage \
    CACHE_DIR=/dados/cache \
    NPM_CONFIG_CACHE=/tmp/npm-cache
USER node

FROM navegador AS dev
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/package.json /app/package-lock.json ./
ENV NODE_ENV=development \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NPM_CONFIG_CACHE=/npm-cache
RUN mkdir -p /app/.next /npm-cache && chown node:node /app/.next /npm-cache
USER node
EXPOSE 3000
CMD ["sh", "/usr/local/bin/dev-comando", "npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

FROM deps AS build
COPY . .
# Valores fictícios: o build não recebe segredos nem acessa o banco de produção.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    APP_URL=https://build.invalid/ssap npm run build

FROM navegador AS app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    STORAGE_DIR=/dados/storage \
    CACHE_DIR=/dados/cache
RUN mkdir -p /app/.next/cache && chown -R node:node /app/.next
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/ssap/api/saude',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
