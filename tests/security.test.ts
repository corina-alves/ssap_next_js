import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import type pg from 'pg';
import { montarLinkSenha } from '../src/lib/auth/link';
import { configuracaoBanco } from '../src/lib/db-config';
import { ErroBanco, protegerBanco } from '../src/lib/db-seguro';
import { query, transacao } from '../src/lib/db';
import { validarEnv } from '../src/lib/env';
import { codigoErro, ErroOperacional, erroParaOperador } from '../src/lib/erros';
import { origemIp } from '../src/lib/origem';

const bancoTeste = 'postgres://ssap:senha-apenas-do-teste@localhost:5432/ssap';
const producao = { DATABASE_URL: bancoTeste, NODE_ENV: 'production', APP_URL: 'https://situacao.example.org/ssap' };

test('produção exige URL pública canônica HTTPS, sem credenciais ou parâmetros', () => {
  for (const APP_URL of [undefined, '', 'http://situacao.example.org/ssap', 'https://situacao.example.org/', 'https://situacao.example.org/ssap?token=exposto', 'https://operador:segredo@site.example.org/ssap', 'inválido']) {
    assert.throws(() => validarEnv({ ...producao, APP_URL }), /APP_URL/);
  }
  assert.equal(validarEnv(producao).APP_URL, producao.APP_URL);
});

test('validação nunca inclui senha/URL privadas no erro', () => {
  const senha = 'NAO-EXIBIR-CREDENCIAL-123';
  for (const DATABASE_URL of [`postgres://ssap:${senha}@localhost:5432/ssap?sslmode=no-verify`, `senha=${senha}`]) {
    assert.throws(() => validarEnv({ ...producao, DATABASE_URL }), (e: unknown) => e instanceof Error && !e.message.includes(senha));
  }
  assert.throws(() => validarEnv({ ...producao, DATABASE_URL: 'postgres://ssap@localhost/ssap' }), /exige senha/);
});

test('TLS de produção verifica certificado e não pode ser substituído pela URL', () => {
  const config = configuracaoBanco(validarEnv(producao));
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  assert.equal(config.connectionTimeoutMillis, 10_000);
  assert.equal(configuracaoBanco(validarEnv({ ...producao, DB_SSL_MODE: 'disable' })).ssl, false);
  for (const parametro of ['sslmode=require', 'sslrootcert=/tmp/ca.pem', 'sslcert=/tmp/cert.pem', 'sslkey=/tmp/key.pem', 'uselibpqcompat=true']) {
    assert.throws(() => validarEnv({ ...producao, DATABASE_URL: `${bancoTeste}?${parametro}` }), /parâmetros ssl/);
  }
  assert.throws(() => validarEnv({ ...producao, DB_SSL_MODE: 'disable', DB_SSL_CA_ARQUIVO: '/tmp/ca.pem' }), /certificado CA/);
});

test('links de redefinição sempre usam a URL configurada e incluem /ssap uma vez', () => {
  const token = 'a'.repeat(64);
  for (const base of ['https://situacao.example.org', 'https://situacao.example.org/ssap', 'https://situacao.example.org/ssap/']) {
    assert.equal(montarLinkSenha(base, token), `https://situacao.example.org/ssap/acesso/redefinir-senha?token=${token}`);
  }
  assert.throws(() => montarLinkSenha(producao.APP_URL, '../token'), /Token/);
});

test('IP forjado é ignorado sem proxy confiável; proxy usa apenas o último IP', () => {
  const h = new Headers({ 'x-forwarded-for': '198.51.100.44, ::ffff:192.0.2.8' });
  assert.equal(origemIp(h, false), '0.0.0.0');
  assert.equal(origemIp(h, true), '192.0.2.8');
  assert.equal(origemIp(new Headers({ 'x-forwarded-for': '198.51.100.44, inválido' }), true), '0.0.0.0');
  assert.equal(origemIp(new Headers({ 'x-forwarded-for': '2001:db8::1' }), true), '2001:db8::1');
});

test('erros de driver não expõem message/detail/stack ao operador', () => {
  const erro = Object.assign(new Error('password=NAO-EXIBIR'), { code: '28P01', detail: 'token=NAO-EXIBIR' });
  assert.equal(codigoErro(erro), '28P01');
  assert.doesNotMatch(erroParaOperador(erro), /NAO-EXIBIR|password|token/);
  assert.equal(codigoErro({ code: 'password=NAO-EXIBIR' }), 'ERRO_INTERNO');
  assert.equal(erroParaOperador(new ErroOperacional('Confirmação inválida.')), 'Confirmação inválida.');
});

test('fronteira do banco remove message/detail/cause/constraint antes do logger Next', async () => {
  const segredo = 'NAO-EXIBIR-VALOR-DA-LINHA';
  const erro = Object.assign(new Error(`chave duplicada password=${segredo}`), {
    code: '23505', detail: `(email)=(${segredo})`, constraint: segredo,
    cause: new Error(`postgres://usuario:${segredo}@banco/ssap`),
  });
  const validar = (e: unknown) => {
    assert.ok(e instanceof ErroBanco);
    assert.equal(e.code, '23505');
    assert.doesNotMatch(JSON.stringify({ ...e, message: e.message, stack: e.stack }), new RegExp(segredo));
    assert.equal(e.cause, undefined);
    assert.equal('detail' in e, false);
    assert.equal('constraint' in e, false);
    return true;
  };
  const poolSeguro = protegerBanco({
    query: async () => { throw erro; },
    connect: async () => ({ query: async () => { throw erro; } }),
  });
  await assert.rejects(poolSeguro.query(), validar);
  const cliente = await poolSeguro.connect();
  await assert.rejects(cliente.query(), validar);
  await assert.rejects(protegerBanco({ connect: async () => { throw erro; } }).connect(), validar);
});

test('callback do driver recebe apenas erro seguro e preserva código FK', async () => {
  const erro = Object.assign(new Error('dados privados'), { code: '23503', detail: 'linha privada' });
  const cliente = protegerBanco({ query: (callback: (e: unknown) => void) => callback(erro) });
  await new Promise<void>((resolve) => cliente.query((e) => {
    assert.ok(e instanceof ErroBanco);
    assert.equal(e.code, '23503');
    assert.doesNotMatch(e.message, /privad/);
    resolve();
  }));
});

test('consulta envia payload SQL somente no vetor de parâmetros', async () => {
  const contexto = globalThis as unknown as { __ssapPool?: pg.Pool };
  const anterior = contexto.__ssapPool;
  const valor = "' OR 1=1; DROP TABLE usuarios; --";
  const sql = 'SELECT id FROM usuarios WHERE login = $1';
  contexto.__ssapPool = { query: async (texto: string, parametros: unknown[]) => {
    assert.equal(texto, sql);
    assert.deepEqual(parametros, [valor]);
    return { rows: [] };
  } } as unknown as pg.Pool;
  try { assert.deepEqual(await query(sql, [valor]), []); } finally { contexto.__ssapPool = anterior; }
});

test('filtros reais administrativos/públicos e login mantêm SQL malicioso em parâmetros', () => {
  const script = `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    // O marcador de build é liberado somente neste processo isolado de teste.
    const require = createRequire(import.meta.url);
    const marcador = require.resolve('server-only');
    require.cache[marcador] = { id: marcador, filename: marcador, loaded: true, exports: {} };
    const chamadas = [];
    globalThis.__ssapPool = { query: async (sql, params) => {
      chamadas.push({ sql, params });
      return { rows: sql.includes('count(*)') ? [{ n: 0 }] : [] };
    }};
    const payload = "' OR 1=1; DROP TABLE usuarios; --";
    const { listar } = await import('./src/lib/admin/usuarios.ts');
    const { listarAuditoria } = await import('./src/lib/admin/auditoria.ts');
    const documentos = await import('./src/lib/documentos.ts');
    const boletins = await import('./src/lib/boletins.ts');
    const publico = await import('./src/lib/publico.ts');
    await listar({ busca: payload, status: payload }, 1);
    await listarAuditoria([1], { usuario: payload, modulo: payload, acao: payload }, 1);
    await documentos.listar([1], { busca: payload }, 1);
    await documentos.listarPublicos({ busca: payload, sala: payload, categoria: payload }, 20);
    await boletins.listar([1], { busca: payload, status: payload, de: payload, ate: payload }, 1);
    await publico.listarPublicados({ busca: payload, sala: payload, tipo: payload, de: payload, ate: payload }, 20);
    assert.equal(chamadas.length, 12);
    for (const { sql, params } of chamadas) {
      assert.ok(!sql.includes(payload));
      assert.ok(params.some((p) => typeof p === 'string' && p.includes(payload)));
      assert.ok(sql.includes('$1'));
    }
    chamadas.length = 0;
    const { login } = await import('./src/lib/auth/login.ts');
    const resultado = await login(payload, 'senha-invalida-123', { ip: '192.0.2.1', userAgent: null });
    assert.equal(resultado.ok, false);
    assert.ok(chamadas.some(({ sql, params }) => sql.includes('senha_hash') && params[0] === payload));
    assert.ok(chamadas.every(({ sql }) => !sql.includes(payload)));
  `;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('rollback com falha preserva o erro original e descarta a conexão', async () => {
  const contexto = globalThis as unknown as { __ssapPool?: pg.Pool };
  const anterior = contexto.__ssapPool;
  const erro = new Error('Falha da operação.');
  let descartada = false;
  contexto.__ssapPool = { connect: async () => ({
    query: async (sql: string) => { if (sql === 'ROLLBACK') throw new Error('Conexão perdida.'); },
    release: (descartar: boolean) => { descartada = descartar; },
  }) } as unknown as pg.Pool;
  try {
    await assert.rejects(transacao(async () => { throw erro; }), (e: unknown) => e === erro);
    assert.equal(descartada, true);
  } finally { contexto.__ssapPool = anterior; }
});
