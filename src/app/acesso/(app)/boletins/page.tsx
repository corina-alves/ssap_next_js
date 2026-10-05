import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { inteiro, Paginacao, texto } from '@/components/paginacao';
import { acl } from '@/lib/auth/acl';
import { listar, ROTULO_STATUS, salasComPermissao, STATUS, tiposAtivos } from '@/lib/boletins';
import { dataBr, dataHora } from '@/lib/formato';

export const metadata: Metadata = { title: 'Boletins' };

const POR_PAGINA = 20;

export default async function PaginaBoletins({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const a = await acl();
  const salas = await salasComPermissao(a, 'visualizar_boletins');
  if (!salas.length) redirect('/acesso/sem-acesso');
  const podeCriar = (await salasComPermissao(a, 'criar_boletim')).length > 0;

  const sp = await searchParams;
  const f = {
    sala: inteiro(sp.sala),
    tipo: inteiro(sp.tipo),
    status: texto(sp.status, 20),
    busca: texto(sp.busca),
    de: texto(sp.de, 10),
    ate: texto(sp.ate, 10),
  };
  const pagina = Math.max(1, inteiro(sp.p));
  const [{ itens, total }, tipos] = await Promise.all([
    listar(salas.map((s) => s.id), { ...f, salaId: f.sala, tipoId: f.tipo }, pagina, POR_PAGINA),
    tiposAtivos(salas.map((s) => s.id)),
  ]);

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Boletins</h1>
          <p className="suave">Boletins das salas a que você tem acesso.</p>
        </div>
        {podeCriar && (
          <Link href="/acesso/boletins/novo" className="botao">
            Novo boletim
          </Link>
        )}
      </div>
      {sp.excluido && <div className="alerta alerta-ok">Boletim excluído.</div>}

      <section className="cartao">
        <form className="filtros" method="get">
          <input type="search" name="busca" defaultValue={f.busca} placeholder="Buscar pelo título" aria-label="Buscar" />
          {salas.length > 1 && (
            <select name="sala" defaultValue={f.sala || ''} aria-label="Sala">
              <option value="">Todas as salas</option>
              {salas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          )}
          <select name="tipo" defaultValue={f.tipo || ''} aria-label="Tipo">
            <option value="">Todos os tipos</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={f.status} aria-label="Status">
            <option value="">Todos os status</option>
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS[s]}
              </option>
            ))}
          </select>
          <label className="inline">
            De <input type="date" name="de" defaultValue={f.de} />
          </label>
          <label className="inline">
            Até <input type="date" name="ate" defaultValue={f.ate} />
          </label>
          <button type="submit" className="botao botao-secundario">
            Filtrar
          </button>
        </form>

        {itens.length === 0 ? (
          <p className="suave">Nenhum boletim encontrado.</p>
        ) : (
          <div className="rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Referência</th>
                  <th>Título</th>
                  <th>Sala / tipo</th>
                  <th>Status</th>
                  <th>Última alteração</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((b) => (
                  <tr key={b.id}>
                    <td>{dataBr(b.data_referencia)}</td>
                    <td>
                      <Link href={`/acesso/boletins/${b.id}`}>
                        <strong>{b.titulo}</strong>
                      </Link>
                      {!b.tem_pdf && <span className="etiqueta status-bloqueado">sem PDF</span>}
                    </td>
                    <td>
                      <small>
                        {b.sala} · {b.tipo_nome}
                      </small>
                    </td>
                    <td>
                      <span className={`etiqueta bol-${b.status}`}>{ROTULO_STATUS[b.status]}</span>
                    </td>
                    <td>
                      <small>
                        {dataHora(b.atualizado_em ?? b.criado_em)}
                        {b.atualizado_por_nome && ` · ${b.atualizado_por_nome}`}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacao
          total={total}
          pagina={pagina}
          porPagina={POR_PAGINA}
          base="/acesso/boletins"
          params={{ ...f, sala: f.sala ? String(f.sala) : undefined, tipo: f.tipo ? String(f.tipo) : undefined }}
        />
      </section>
    </>
  );
}
