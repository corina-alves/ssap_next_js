import pg from 'pg';
import { configuracaoBanco } from './db-config';
import { protegerBanco } from './db-seguro';
import { env } from './env';
import { codigoErro } from './erros';

// Um pool por processo; em desenvolvimento o hot reload reaproveita o mesmo.
const global_ = globalThis as unknown as { __ssapPool?: pg.Pool };

export function pool(): pg.Pool {
  if (!global_.__ssapPool) {
    global_.__ssapPool = protegerBanco(new pg.Pool({
      ...configuracaoBanco(),
      max: env().DB_POOL_MAX,
      idleTimeoutMillis: 30_000,
      statement_timeout: 30_000,
      idle_in_transaction_session_timeout: 30_000,
    }));
    // Conexão ociosa derrubada (banco reiniciado, rede): o pool descarta e abre outra
    // na próxima consulta. Sem este tratador, o erro viraria exceção não capturada.
    global_.__ssapPool.on('error', (e) => console.error('Conexão ociosa com o banco encerrada:', codigoErro(e)));
  }
  // Também protege pools mantidos no global por uma versão anterior do hot reload.
  return protegerBanco(global_.__ssapPool);
}

/** Fecha apenas um pool já criado, inclusive quando a validação inicial falhou. */
export async function encerrarPool(): Promise<void> {
  if (global_.__ssapPool) await global_.__ssapPool.end();
}

/** Consulta parametrizada — nunca concatenar valores no SQL. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const r = await pool().query<T>(sql, params);
  return r.rows;
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Executa `fn` numa transação; desfaz tudo se lançar erro. */
export async function transacao<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  let descartar = false;
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    // Preserva o erro original e descarta a conexão se a rede impedir rollback.
    await c.query('ROLLBACK').catch(() => { descartar = true; });
    throw e;
  } finally {
    c.release(descartar);
  }
}
