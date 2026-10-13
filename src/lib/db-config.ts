import { readFileSync } from 'node:fs';
import type pg from 'pg';
import { env, type Env } from './env';

/** A mesma política de conexão para aplicação e ferramentas administrativas. */
export function configuracaoBanco(config: Env = env()): pg.ClientConfig {
  const tls = config.DB_SSL_MODE ?? (config.NODE_ENV === 'production' ? 'verify-full' : 'disable');
  let ca: string | undefined;
  if (config.DB_SSL_CA_ARQUIVO) {
    try {
      ca = readFileSync(/*turbopackIgnore: true*/ config.DB_SSL_CA_ARQUIVO, 'utf8');
    } catch {
      throw new Error('Não foi possível ler DB_SSL_CA_ARQUIVO. Confira o arquivo e as permissões.');
    }
  }
  return {
    connectionString: config.DATABASE_URL,
    ssl: tls === 'verify-full' ? { rejectUnauthorized: true, ...(ca ? { ca } : {}) } : false,
    connectionTimeoutMillis: config.DB_TIMEOUT_MS,
    application_name: 'ssap',
    keepAlive: true,
  };
}
