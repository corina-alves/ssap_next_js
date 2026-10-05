import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { acl } from '@/lib/auth/acl';
import {
  acoesDisponiveis,
  historico,
  obter,
  podeEditar,
  podeExcluir,
  ROTULO_STATUS,
  salasComPermissao,
  versoes,
} from '@/lib/boletins';
import { dataBr, dataHora } from '@/lib/formato';
import { ExcluirBoletim, FormEditarBoletim, PainelAcoes } from '../componentes';

export const metadata: Metadata = { title: 'Boletim' };

function tamanho(bytes: string | null): string {
  const n = Number(bytes ?? 0);
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
}

export default async function VerBoletim({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criado?: string }>;
}) {
  const a = await acl();
  const { id: idTexto } = await params;
  const b = /^\d{1,15}$/.test(idTexto) ? await obter(Number(idTexto)) : null;
  if (!b) notFound();
  const salas = await salasComPermissao(a, 'visualizar_boletins');
  if (!salas.some((s) => s.id === b.sala_id)) redirect('/acesso/sem-acesso');

  const [vs, hs, { criado }] = await Promise.all([versoes(Number(b.id)), historico(Number(b.id)), searchParams]);
  const acoes = acoesDisponiveis(b, a);

  return (
    <>
      <p className="trilha">
        <Link href="/acesso/boletins">Boletins</Link> / {b.sala_nome}
      </p>
      <div className="cabecalho">
        <div>
          <h1>{b.titulo}</h1>
          <p className="suave">
            {b.tipo_nome} · referência {dataBr(b.data_referencia)}
            {b.competencia && ` · competência ${b.competencia}`}
          </p>
        </div>
        <span className={`etiqueta etiqueta-grande bol-${b.status}`}>{ROTULO_STATUS[b.status]}</span>
      </div>
      {criado && <div className="alerta alerta-ok">Boletim cadastrado como rascunho.</div>}

      <div className="colunas">
        <section className="cartao">
          <h2>Arquivo</h2>
          {b.pdf_arquivo_id ? (
            <p>
              <a href={`/acesso/boletins/${b.id}/pdf`} target="_blank" rel="noopener">
                {b.pdf_nome}
              </a>{' '}
              <small className="suave">({tamanho(b.pdf_tamanho)})</small>
            </p>
          ) : (
            <p className="suave">Sem PDF.</p>
          )}
          <dl className="dados">
            <dt>Criado</dt>
            <dd>
              {dataHora(b.criado_em)} {b.criado_por_nome && `· ${b.criado_por_nome}`}
            </dd>
            <dt>Última alteração</dt>
            <dd>
              {dataHora(b.atualizado_em)} {b.atualizado_por_nome && `· ${b.atualizado_por_nome}`}
            </dd>
            {b.publicado_em && (
              <>
                <dt>Publicado</dt>
                <dd>
                  {dataHora(b.publicado_em)} {b.publicado_por_nome && `· ${b.publicado_por_nome}`}
                </dd>
              </>
            )}
            <dt>Regras do tipo</dt>
            <dd>
              {b.exige_revisao ? 'exige revisão' : 'publicação direta'} · {b.tipo_publico ? 'público' : 'interno'}
            </dd>
          </dl>
        </section>
        <PainelAcoes id={b.id} acoes={acoes} />
      </div>

      {podeEditar(b, a) && (
        <FormEditarBoletim
          id={b.id}
          inicialValores={{ tipoId: b.tipo_id, titulo: b.titulo, dataReferencia: b.data_referencia, competencia: b.competencia ?? '' }}
        />
      )}

      <div className="colunas">
        <section className="cartao">
          <h2>Versões</h2>
          <ul className="lista-simples">
            {vs.map((v) => (
              <li key={v.versao}>
                <strong>v{v.versao}</strong> · {ROTULO_STATUS[v.status]} · {dataHora(v.criado_em)}
                {v.autor && ` · ${v.autor}`}
                <br />
                <small className="suave">{v.comentario}</small>
                {v.tem_pdf && (
                  <>
                    {' '}
                    <a href={`/acesso/boletins/${b.id}/pdf?v=${v.versao}`} target="_blank" rel="noopener">
                      <small>PDF desta versão</small>
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="cartao">
          <h2>Histórico de status</h2>
          <ul className="lista-simples">
            {hs.map((h, i) => (
              <li key={i}>
                {h.status_de ? `${ROTULO_STATUS[h.status_de]} → ` : ''}
                <strong>{ROTULO_STATUS[h.status_para]}</strong> · {dataHora(h.criado_em)}
                {h.autor && ` · ${h.autor}`}
                {h.comentario && (
                  <>
                    <br />
                    <small className="suave">“{h.comentario}”</small>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {podeExcluir(b, a) && (
        <section className="cartao">
          <ExcluirBoletim id={b.id} />
        </section>
      )}
    </>
  );
}
