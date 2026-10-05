import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { acl } from '@/lib/auth/acl';
import { salasComPermissao, tiposAtivos } from '@/lib/boletins';
import { FormNovoBoletim } from '../componentes';

export const metadata: Metadata = { title: 'Novo boletim' };

export default async function NovoBoletim({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const a = await acl();
  // Atalho "Gerar boletim" do painel: já abre com o tipo escolhido.
  const tipoPedido = Number((await searchParams).tipo) || 0;
  const salas = await salasComPermissao(a, 'criar_boletim');
  if (!salas.length) redirect('/acesso/sem-acesso');
  const tipos = await tiposAtivos(salas.map((s) => s.id));
  const grupos = salas
    .map((s) => ({ sala: s.nome, tipos: tipos.filter((t) => t.sala_id === s.id) }))
    .filter((g) => g.tipos.length > 0);
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

  return (
    <>
      <p className="trilha">
        <Link href="/acesso/boletins">Boletins</Link> / Novo boletim
      </p>
      <h1>Novo boletim</h1>
      {grupos.length === 0 ? (
        <p>Nenhum tipo de boletim ativo nas suas salas. Peça ao administrador para cadastrar um.</p>
      ) : (
        <FormNovoBoletim grupos={grupos} inicialValores={{ tipoId: tipos.some((t) => t.id === tipoPedido) ? tipoPedido : 0, titulo: '', dataReferencia: hoje, competencia: '' }} />
      )}
    </>
  );
}
