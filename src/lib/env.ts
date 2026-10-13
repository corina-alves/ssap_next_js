import { z } from 'zod';
import { BASE_PATH } from './base-path';

/**
 * Configuração lida do ambiente (.env.local em desenvolvimento).
 * Sem DATABASE_URL a aplicação não inicia — nunca há padrão "root sem senha".
 */
const esquema = z.object({
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL não definida (veja .env.example)' })
    .superRefine((v, ctx) => {
      try {
        const u = new URL(v);
        if (!['postgres:', 'postgresql:'].includes(u.protocol) || !u.hostname || !u.username || u.pathname.length < 2) {
          ctx.addIssue({ code: 'custom', message: 'Informe uma URL PostgreSQL completa (usuário, host e banco).' });
        }
        // O pg substitui o objeto ssl inteiro quando esses parâmetros estão na URL.
        // TLS é configurado exclusivamente por DB_SSL_MODE/DB_SSL_CA_ARQUIVO.
        if ([...u.searchParams.keys()].some((k) => /^ssl|^uselibpqcompat$/i.test(k))) {
          ctx.addIssue({ code: 'custom', message: 'Configure TLS em DB_SSL_MODE/DB_SSL_CA_ARQUIVO, sem parâmetros ssl na DATABASE_URL.' });
        }
      } catch {
        ctx.addIssue({ code: 'custom', message: 'DATABASE_URL deve ser uma URL PostgreSQL válida.' });
      }
    }),
  DB_SSL_MODE: z.enum(['disable', 'verify-full']).optional(),
  DB_SSL_CA_ARQUIVO: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DB_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(10_000),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  // URL pública canônica com o prefixo /ssap. Obrigatória e HTTPS em produção.
  APP_URL: z.preprocess((v) => (v === '' ? undefined : v), z.url({ protocol: /^https?$/ }).optional()),
  // Pasta dos arquivos enviados (PDFs, documentos), FORA da pasta pública.
  STORAGE_DIR: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
}).superRefine((v, ctx) => {
  let publica: URL | undefined;
  try { if (v.APP_URL) publica = new URL(v.APP_URL); } catch { /* z.url já informa o erro. */ }
  if (publica) {
    if (publica.username || publica.password || publica.search || publica.hash || !['', '/', BASE_PATH, `${BASE_PATH}/`].includes(publica.pathname)) {
      ctx.addIssue({ code: 'custom', path: ['APP_URL'], message: `Informe somente a origem pública e o caminho ${BASE_PATH}, sem credenciais, query ou fragmento.` });
    }
  }
  if (v.NODE_ENV === 'production') {
    if (!publica || publica.protocol !== 'https:' || publica.pathname.replace(/\/$/, '') !== BASE_PATH) {
      ctx.addIssue({ code: 'custom', path: ['APP_URL'], message: `Produção exige APP_URL=https://DOMINIO${BASE_PATH}.` });
    }
    try {
      if (!new URL(v.DATABASE_URL).password) {
        ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'A conexão de produção exige senha do usuário PostgreSQL.' });
      }
    } catch { /* A validação de DATABASE_URL já informa o erro. */ }
  }
  if (v.DB_SSL_CA_ARQUIVO && (v.DB_SSL_MODE ?? (v.NODE_ENV === 'production' ? 'verify-full' : 'disable')) === 'disable') {
    ctx.addIssue({ code: 'custom', path: ['DB_SSL_CA_ARQUIVO'], message: 'O certificado CA exige DB_SSL_MODE=verify-full.' });
  }
});

export type Env = z.infer<typeof esquema>;

/** Valida sem incorporar valores do ambiente nas mensagens de erro. */
export function validarEnv(entrada: Record<string, unknown>): Env {
  const r = esquema.safeParse(entrada);
  if (!r.success) {
    const erros = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuração inválida:\n${erros}`);
  }
  return r.data;
}

let cache: Env | undefined;

export function env(): Env {
  if (!cache) {
    cache = validarEnv(process.env);
  }
  return cache;
}
