'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { EstadoAdmin } from '@/lib/admin/estado';
import { campo, campoId } from '@/lib/admin/validacao';
import { acl } from '@/lib/auth/acl';
import * as boletins from '@/lib/boletins';
import { origemRequisicao } from '@/lib/requisicao';

export type ValoresBoletim = { tipoId: number; titulo: string; dataReferencia: string; competencia: string };

async function contexto() {
  const a = await acl();
  return { a, autor: { id: a.usuario.id, nome: a.usuario.nome }, origem: await origemRequisicao() };
}

function lerDados(form: FormData): ValoresBoletim {
  return {
    tipoId: campoId(form, 'tipo_id'),
    titulo: campo(form, 'titulo'),
    dataReferencia: campo(form, 'data_referencia'),
    competencia: campo(form, 'competencia'),
  };
}

function revalidar(id?: number) {
  revalidatePath('/acesso/boletins');
  if (id) revalidatePath(`/acesso/boletins/${id}`);
  revalidatePath('/boletins', 'layout'); // páginas públicas
}

export async function criarBoletimAcao(_: EstadoAdmin<ValoresBoletim>, form: FormData): Promise<EstadoAdmin<ValoresBoletim>> {
  const { a, autor, origem } = await contexto();
  const dados = lerDados(form);
  const r = await boletins.criar(a, dados, form.get('pdf'), autor, origem);
  if (!r.ok) return { erros: r.erros, valores: dados, versao: Date.now() };
  revalidar();
  redirect(`/acesso/boletins/${r.id}?criado=1`);
}

export async function editarBoletimAcao(_: EstadoAdmin<ValoresBoletim>, form: FormData): Promise<EstadoAdmin<ValoresBoletim>> {
  const { a, autor, origem } = await contexto();
  const id = campoId(form);
  const dados = lerDados(form);
  const r = await boletins.atualizar(a, id, dados, form.get('pdf'), autor, origem);
  if (!r.ok) return { erros: r.erros, valores: dados, versao: Date.now() };
  revalidar(id);
  return { erros: [], mensagem: r.mudou ? 'Alterações salvas (nova versão registrada).' : 'Nenhuma alteração.', versao: Date.now() };
}

/** O botão clicado vem como name="acao" (cada ação é um botão de envio). */
export async function transicionarAcao(_: EstadoAdmin, form: FormData): Promise<EstadoAdmin> {
  const { a, autor, origem } = await contexto();
  const id = campoId(form);
  const acao = campo(form, 'acao');
  const r = await boletins.transicionar(a, id, acao, campo(form, 'comentario'), autor, origem);
  if (!r.ok) return { erros: r.erros, versao: Date.now() };
  revalidar(id);
  return { erros: [], mensagem: `Status alterado para "${boletins.ROTULO_STATUS[r.para]}".`, versao: Date.now() };
}

export async function excluirBoletimAcao(_: EstadoAdmin, form: FormData): Promise<EstadoAdmin> {
  const { a, autor, origem } = await contexto();
  const erros = await boletins.excluir(a, campoId(form), autor, origem);
  if (erros.length) return { erros, versao: Date.now() };
  revalidar();
  redirect('/acesso/boletins?excluido=1');
}
