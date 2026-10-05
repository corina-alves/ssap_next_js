import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Cabecalho } from '@/components/acesso/pecas';
import { ScriptsLegado } from '@/components/acesso/scripts-legado';
import { SelectAutoEnvio } from '@/components/site/auto-envio';
import limites from '@/conteudo/ugrhi.json';
import { acl } from '@/lib/auth/acl';
import {
  HORAS_CHUVA,
  hora,
  LIMITE_CHUVA_MM,
  m,
  mapaUgrhi,
  SITUACOES,
  situacaoRios,
  texto,
  textoChuvaWhatsapp,
  textoWhatsapp,
  UGRHIS,
  type Posto,
  type Situacao,
} from '@/lib/hidrologia/situacao-rios';

export const metadata: Metadata = { title: 'Defesa Civil' };

const ORDEM = Object.keys(SITUACOES) as Situacao[];
const GRAVES = ['atencao', 'alerta', 'emergencia', 'extravasamento'] as const;
const ICONES: Record<Situacao, string> = {
  extravasamento: 'bi-exclamation-octagon-fill',
  emergencia: 'bi-exclamation-triangle-fill',
  alerta: 'bi-exclamation-circle-fill',
  atencao: 'bi-eye-fill',
  normal: 'bi-check-circle-fill',
};
const SETAS = { elevacao: ['bi-arrow-up-right', 'Subindo'], reducao: ['bi-arrow-down-right', 'Descendo'], estavel: ['bi-arrow-right', 'Estável'] } as const;

const nomeUgrhi = (u: number) => (UGRHIS[u] ? `UGRHI ${u} — ${UGRHIS[u]}` : 'Sem UGRHI');
const pior = (lista: Posto[]): Situacao => lista[0]?.situacao ?? 'normal'; // já vem ordenado por gravidade
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

type Geometria = { type: string; coordinates: unknown };
/** Limite (GeoJSON) de uma UGRHI — camada LimiteUGRHI do DataGEO. */
function limiteUgrhi(u: number): Geometria | null {
  const f = (limites as { features: { properties: { codigo: number }; geometry: Geometria }[] }).features.find((x) => Number(x.properties.codigo) === u);
  return f?.geometry ?? null;
}

const fmtDataHora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtArquivo = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

/**
 * Defesa Civil — painel de alerta dos rios, córregos e piscinões por UGRHI,
 * com o texto de resposta pronto para copiar e o mapa da UGRHI (limite, chuva
 * acumulada acima de 10 mm e estações telemétricas), que vira imagem para o
 * WhatsApp. Aberto a quem vê o painel de alguma Sala de Situação.
 */
export default async function DefesaCivil({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const a = await acl();
  if (!a.podeEmAlguma('visualizar_dashboard')) redirect('/acesso/sem-acesso');

  const sp = await searchParams;
  const situacao = await situacaoRios(um(sp.atualizar) === '1');
  const { postos } = situacao;

  const porUgrhi = new Map<number, Posto[]>();
  for (const p of postos) porUgrhi.set(p.ugrhi, [...(porUgrhi.get(p.ugrhi) ?? []), p]);
  const ugrhisComPosto = [...porUgrhi.keys()].sort(
    (x, y) => ORDEM.indexOf(pior(porUgrhi.get(x)!)) - ORDEM.indexOf(pior(porUgrhi.get(y)!)) || x - y,
  );

  const filtro = um(sp.ugrhi);
  const horas = HORAS_CHUVA[Number(um(sp.horas))] ? Number(um(sp.horas)) : 24; // chuva acumulada do mapa
  const mostrar =
    filtro === 'todas'
      ? ugrhisComPosto
      : /^\d+$/.test(filtro) && UGRHIS[Number(filtro)]
        ? [Number(filtro)] // com ou sem posto com cota: mostra o mapa
        : ugrhisComPosto.filter((u) => pior(porUgrhi.get(u)!) !== 'normal');

  const totais = Object.fromEntries(ORDEM.map((k) => [k, postos.filter((p) => p.situacao === k).length])) as Record<Situacao, number>;
  const situacaoPorId = new Map(postos.map((p) => [p.id, p.situacao]));
  const geradoEm = new Date(situacao.gerado_em * 1000);
  const quando = `${fmtDataHora.format(geradoEm)} ${hora(situacao.gerado_em)}`;

  const blocos = await Promise.all(mostrar.map(async (u) => ({ u, lista: porUgrhi.get(u) ?? [], mapa: await mapaUgrhi(u, horas) })));

  const parametros = new URLSearchParams();
  if (filtro) parametros.set('ugrhi', filtro);
  if (horas !== 24) parametros.set('horas', String(horas));
  parametros.set('atualizar', '1');

  return (
    <>
      <link rel="stylesheet" href="/acesso/vendor/leaflet/leaflet.css" precedence="default" />
      <Cabecalho
        titulo="Defesa Civil — situação dos rios, córregos e piscinões"
        subtitulo={`Postos fluviométricos do SIBH com cotas de alerta, por UGRHI. Dados de ${hora(situacao.gerado_em)} (atualiza a cada 3 min).`}
        trilha={[
          ['Painel', '/acesso'],
          ['Defesa Civil', null],
        ]}
        acoes={
          <a className="btn btn-outline-primary" href={`/acesso/defesa_civil?${parametros}`}>
            <i className="bi bi-arrow-clockwise me-1" /> Atualizar
          </a>
        }
      />

      {situacao.falhas.length > 0 && (
        <div className="alert alert-warning">
          <i className="bi bi-exclamation-triangle" /> O SIBH não respondeu tudo agora ({situacao.falhas.join(', ')}).{' '}
          {postos.length ? 'Parte dos dados pode estar desatualizada.' : 'Tente atualizar em instantes.'}
        </div>
      )}

      <div className="row g-2 mb-3">
        {ORDEM.map((k) => (
          <div key={k} className="col-6 col-md">
            <div className={`acesso-kpi dc-kpi dc-kpi--${k}`}>
              <i className={`bi ${ICONES[k]}`} />
              <div>
                <span className="acesso-kpi__valor">{totais[k]}</span>
                <span className="acesso-kpi__rotulo">{SITUACOES[k]}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <form className="acesso-card mb-3 row g-2 align-items-end mx-0" method="get">
        <div className="col-md-6">
          <label className="form-label small" htmlFor="ugrhi">
            UGRHI
          </label>
          <SelectAutoEnvio className="form-select" id="ugrhi" name="ugrhi" defaultValue={filtro}>
            <option value="">UGRHIs com algum ponto fora do normal</option>
            <option value="todas">Todas as UGRHIs</option>
            {Object.keys(UGRHIS).map((u) => (
              <option key={u} value={u}>
                {nomeUgrhi(Number(u))}
                {porUgrhi.has(Number(u)) ? ` (${porUgrhi.get(Number(u))!.length} pontos)` : ''}
              </option>
            ))}
          </SelectAutoEnvio>
        </div>
        <div className="col-md-2">
          <label className="form-label small" htmlFor="horas">
            Chuva no mapa
          </label>
          <SelectAutoEnvio className="form-select" id="horas" name="horas" defaultValue={String(horas)}>
            {Object.entries(HORAS_CHUVA).map(([h, rot]) => (
              <option key={h} value={h}>
                Últimas {rot}
              </option>
            ))}
          </SelectAutoEnvio>
        </div>
        <div className="col-md-4 small text-secondary">
          {postos.length} pontos monitorados no estado (com cota de alerta e leitura na última hora). Nível em metros; cotas ortométricas
          aparecem com a altitude.
        </div>
      </form>

      {mostrar.length === 0 && (
        <div className="acesso-card">
          <p className="mb-0">
            <i className="bi bi-check-circle-fill text-success" />{' '}
            {postos.length
              ? 'Todos os pontos monitorados estão em condição normal. Escolha uma UGRHI acima para ver o texto e a lista.'
              : 'Sem dados do SIBH no momento.'}
          </p>
        </div>
      )}

      {blocos.map(({ u, lista, mapa }) => {
        const fora = lista.filter((p) => p.situacao !== 'normal');
        const limite = limiteUgrhi(u);
        const nFlu = mapa.estacoes.filter((e) => e.t === 'flu').length;
        const cfgMapa = {
          ugrhi: u,
          titulo: nomeUgrhi(u),
          subtitulo: `Chuva acumulada nas últimas ${HORAS_CHUVA[horas]} (postos acima de ${m(LIMITE_CHUVA_MM, 0)} mm) e estações telemétricas · ${quando}`,
          limite,
          chuva: mapa.chuva,
          estacoes: mapa.estacoes.map((e) => ({ ...e, s: situacaoPorId.get(e.id) ?? null })),
          arquivo: `mapa_ugrhi${u}_${fmtArquivo.format(geradoEm).replace(/[-:]/g, '').replace(' ', '_')}`,
          mensagem: `zap-${u}`,
        };
        const tabelas: [string, Posto[], boolean][] = [];
        if (fora.length) tabelas.push(['Pontos fora do normal', fora, true]);
        if (lista.length) tabelas.push([`Todos os ${lista.length} pontos monitorados`, lista, false]);

        return (
          <section key={u} className={`acesso-card mb-3 dc-ugrhi dc-ugrhi--${pior(lista)}`}>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <h2 className="h5 mb-0">{nomeUgrhi(u)}</h2>
              <div className="d-flex flex-wrap gap-1">
                {ORDEM.map((k) => {
                  const n = lista.filter((p) => p.situacao === k).length;
                  return n ? (
                    <span key={k} className={`dc-selo dc-selo--${k}`}>
                      {n} {SITUACOES[k].toLocaleLowerCase('pt-BR')}
                    </span>
                  ) : null;
                })}
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-xl-6">
                <label className="form-label small fw-semibold" htmlFor={`texto-${u}`}>
                  <i className="bi bi-file-text" /> Texto formal <span className="fw-normal text-secondary">(e-mail, ofício)</span>
                </label>
                <textarea className="form-control dc-texto" id={`texto-${u}`} rows={Math.min(16, 4 + 2 * fora.length)} defaultValue={texto(lista)} />
                <div className="mt-2">
                  <button type="button" className="btn btn-sm btn-primary" data-copiar={`texto-${u}`}>
                    <i className="bi bi-clipboard" /> Copiar texto
                  </button>
                  <span className="small text-success ms-2" data-copiado-de={`texto-${u}`} hidden>
                    Copiado!
                  </span>
                </div>
              </div>
              <div className="col-xl-6">
                <label className="form-label small fw-semibold" htmlFor={`zap-${u}`}>
                  <i className="bi bi-whatsapp dc-zap-icone" /> Mensagem para WhatsApp{' '}
                  <span className="fw-normal text-secondary">(com ícones; *negrito* aparece em negrito no WhatsApp)</span>
                </label>
                <textarea
                  className="form-control dc-texto dc-zap"
                  id={`zap-${u}`}
                  rows={Math.min(26, 14 + 3 * fora.length)}
                  defaultValue={textoWhatsapp(lista, nomeUgrhi(u), situacao.gerado_em, textoChuvaWhatsapp(mapa.chuva, horas))}
                />
                <div className="mt-2">
                  <button type="button" className="btn btn-sm btn-success" data-copiar={`zap-${u}`}>
                    <i className="bi bi-clipboard" /> Copiar mensagem
                  </button>{' '}
                  <button type="button" className="btn btn-sm btn-outline-success" data-whatsapp={`zap-${u}`}>
                    <i className="bi bi-whatsapp" /> Abrir no WhatsApp
                  </button>
                  <span className="small text-success ms-2" data-copiado-de={`zap-${u}`} hidden>
                    Copiado!
                  </span>
                </div>
              </div>
            </div>

            {limite && (
              <div className="dc-mapa-bloco mb-3">
                <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-2">
                  <div className="small">
                    <strong>
                      <i className="bi bi-map" /> Mapa da UGRHI
                    </strong>{' '}
                    — {mapa.chuva.length} {mapa.chuva.length === 1 ? 'posto' : 'postos'} com chuva acima de {m(LIMITE_CHUVA_MM, 0)} mm nas
                    últimas {HORAS_CHUVA[horas]}
                    {mapa.chuva[0] ? ` (máx. ${m(mapa.chuva[0].v, 1)} mm)` : ''} · {mapa.estacoes.length - nFlu} pluviométricas e {nFlu}{' '}
                    fluviométricas telemétricas
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <button type="button" className="btn btn-sm btn-success" data-dc-enviar={`mapa-${u}`}>
                      <i className="bi bi-whatsapp" /> Enviar mapa + mensagem
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-secondary" data-dc-baixar={`mapa-${u}`}>
                      <i className="bi bi-download" /> Baixar mapa (imagem)
                    </button>
                  </div>
                </div>
                {mapa.falhas.length > 0 && (
                  <div className="alert alert-warning py-2 small mb-2">
                    O SIBH não respondeu agora ({mapa.falhas.join(', ')}); o mapa usa a última cópia disponível.
                  </div>
                )}
                <div
                  className="dc-mapa"
                  id={`mapa-${u}`}
                  data-dc-mapa={JSON.stringify(cfgMapa)}
                  role="img"
                  aria-label={`Mapa da ${nomeUgrhi(u)} com chuva acumulada e estações telemétricas`}
                />
                <p className="small text-secondary mt-1 mb-0" data-dc-aviso={`mapa-${u}`} hidden />
              </div>
            )}

            {tabelas.map(([titulo, linhas, aberta]) => (
              <details key={titulo} className="dc-detalhes" open={aberta}>
                <summary>{titulo}</summary>
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0 dc-tabela">
                    <thead>
                      <tr>
                        <th>Situação</th>
                        <th>Posto</th>
                        <th>Município</th>
                        <th className="text-end">Nível (m)</th>
                        <th>Hora</th>
                        <th>Tendência (1 h)</th>
                        <th className="text-end">Atenção</th>
                        <th className="text-end">Alerta</th>
                        <th className="text-end">Emergência</th>
                        <th className="text-end">Extravas.</th>
                        <th className="text-end">Acima da cota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <span className={`dc-selo dc-selo--${p.situacao}`}>{SITUACOES[p.situacao]}</span>
                          </td>
                          <td>
                            <strong>{p.prefixo}</strong> {p.nome}
                            {p.piscinao && <span className="badge text-bg-light border ms-1">piscinão</span>}
                          </td>
                          <td>{p.cidade}</td>
                          <td className="text-end fw-semibold">{m(p.nivel, 3)}</td>
                          <td>
                            {p.hora ? (
                              hora(p.hora)
                            ) : (
                              <span className="text-secondary" title="Média da última hora">
                                média 1 h
                              </span>
                            )}
                          </td>
                          <td>
                            {p.tendencia ? (
                              <>
                                <i className={`bi ${SETAS[p.tendencia][0]}`} /> {SETAS[p.tendencia][1]}{' '}
                                <small className="text-secondary">
                                  ({(p.variacao_1h ?? 0) >= 0 ? '+' : ''}
                                  {m(p.variacao_1h, 3)} m)
                                </small>
                              </>
                            ) : (
                              <span className="text-secondary">—</span>
                            )}
                          </td>
                          {GRAVES.map((k) => (
                            <td key={k} className="text-end">
                              {m(p.cotas[k], 2)}
                            </td>
                          ))}
                          <td className="text-end">{p.acima !== null ? `+${m(p.acima, 3)} m` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </section>
        );
      })}

      <p className="small text-secondary">
        Fonte: SIBH — SP Águas. &quot;Acima da cota&quot; = quanto o nível passou da cota da situação. A tendência compara a última leitura
        com a de cerca de 1 h antes. Postos que não passaram de nenhuma cota mostram a média da última hora.
      </p>

      <ScriptsLegado scripts={['/acesso/js/defesa-civil.js', '/acesso/vendor/leaflet/leaflet.js', '/acesso/js/defesa-civil-mapa.js']} />
    </>
  );
}
