/**
 * Gera um link de redefinição de senha pelo terminal, para quando não há outro
 * administrador que possa gerar pelo painel.
 *   npm run senha:link -- <login ou e-mail>
 * Uso único, vale 24 horas, invalida os links anteriores e fica na auditoria.
 */
import { createHash, randomBytes } from 'node:crypto';
import { auditar } from '../src/lib/auditoria';
import { encerrarPool, queryOne, transacao } from '../src/lib/db';
import { env } from '../src/lib/env';
import { ErroOperacional, erroParaOperador } from '../src/lib/erros';
import { montarLinkSenha } from '../src/lib/auth/link';
import { carregarEnv } from './_comum';

carregarEnv();

// Mesma validade de VALIDADE_HORAS.redefinicao (src/lib/auth/redefinicao.ts).
const HORAS = 24;

async function principal(): Promise<void> {
  const alvo = (process.argv[2] ?? '').trim().toLowerCase();
  if (!alvo) throw new ErroOperacional('Uso: npm run senha:link -- <login ou e-mail>');

  const u = await queryOne<{ id: number; nome: string; login: string; status: string }>(
    `SELECT id, nome, login, status FROM usuarios
      WHERE excluido_em IS NULL AND (lower(login) = $1 OR lower(email) = $1)`,
    [alvo],
  );
  if (!u) throw new ErroOperacional('Usuário não encontrado.');
  if (u.status !== 'ativo') throw new ErroOperacional('O usuário está inativo/bloqueado. Reative-o antes de gerar o link.');

  const token = randomBytes(32).toString('hex');
  await transacao(async (c) => {
    const ativo = await c.query('SELECT id FROM usuarios WHERE id = $1 AND status = \'ativo\' AND excluido_em IS NULL FOR UPDATE', [u.id]);
    if (ativo.rowCount !== 1) throw new ErroOperacional('O usuário está indisponível para redefinição.');
    await c.query('UPDATE senha_tokens SET usado_em = now() WHERE usuario_id = $1 AND usado_em IS NULL', [u.id]);
    await c.query(
      `INSERT INTO senha_tokens (usuario_id, token_hash, expira_em)
       VALUES ($1, $2, now() + make_interval(hours => $3))`,
      [u.id, createHash('sha256').update(token).digest('hex'), HORAS],
    );
    await auditar(
      { modulo: 'auth', acao: 'senha_link_gerado', entidade: 'usuarios', entidadeId: u.id,
        descricao: `Link de redefinição gerado pelo terminal para ${u.login} (validade ${HORAS} h)` },
      c,
    );
  });

  const base = env().APP_URL ?? 'http://localhost:3000/ssap';
  console.log(`Link para ${u.nome} (${u.login}), válido por ${HORAS} horas, uso único:\n`);
  console.log(montarLinkSenha(base, token));
}

principal()
  .catch((e) => {
    console.error(erroParaOperador(e));
    process.exitCode = 1;
  })
  .finally(encerrarPool);
