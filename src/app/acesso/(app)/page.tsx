import type { Metadata } from 'next';
import Link from 'next/link';
import { Indicadores } from '@/components/acesso/indicadores';
import { Cabecalho, corSala, Mensagem } from '@/components/acesso/pecas';
import { salasPainel, type SalaPainel } from '@/lib/acesso/painel';
import { acl } from '@/lib/auth/acl';
import { TIPOS } from '@/lib/hidrologia/grafico-ssd';
import { hojeSp, somarDias } from '@/lib/integracoes/comum';

export const metadata: Metadata = { title: 'Painel' };

const ABAS = [
  ['', 'Visão geral', 'bi-speedometer2'],
  ['graficos', 'Criar gráficos', 'bi-bar-chart-line'],
] as const;

/** Outros jeitos de montar um gráfico com o SSD, além da série no tempo do formulário. */
const OUTROS = [
  ['Comparar anos × MLT', 'Mês a mês de cada ano contra a média de longo termo, para qualquer local e variável do SSD.', 'bi-calendar3', 'formato=anos'],
  ['Comparar locais', 'Barras com vários locais lado a lado na mesma variável e período.', 'bi-bar-chart-steps', 'formato=locais'],
] as const;

/**
 * Aba "Criar gráficos": começa um gráfico com dados do SSD SP Águas a partir
 * das datas (locais e variáveis são escolhidos na página do gráfico) ou abre
 * os outros formatos e o gráfico livre.
 */
function CriarGraficos({ a, salas }: { a: Awaited<ReturnType<typeof acl>>; salas: SalaPainel[] }) {
  const comGraficos = salas.filter((s) => s.modulos.some((m) => m.slug === 'graficos') && a.pode('visualizar_graficos', s.id));
  if (comGraficos.length === 0) {
    return (
      <div className="acesso-card">
        <p className="mb-0 text-secondary">
          <i className="bi bi-info-circle" /> Nenhuma das suas salas tem o módulo de gráficos liberado para o seu perfil.
        </p>
      </div>
    );
  }
  const hoje = hojeSp();
  const base = '/acesso/graficos/criar-ssd';

  return (
    <>
      <section className="acesso-card mb-3">
        <h2 className="acesso-card__titulo">
          <i className="bi bi-graph-up" /> Gráfico com dados do SSD SP Águas
        </h2>
        <p className="small text-secondary">
          Escolha o período e o tipo; na página seguinte você seleciona até seis séries entre sistemas, reservatórios, túneis, ETAs, postos e
          bacias (chuva, vazões, volume, nível) e pode salvar o gráfico na sala.
        </p>
        <form className="row g-2 align-items-end" method="get" action={base}>
          <input type="hidden" name="formato" value="tempo" />
          <input type="hidden" name="periodo" value="personalizado" />
          <div className="col-md-3">
            <label className="form-label small" htmlFor="g-sala">
              Sala
            </label>
            <select className="form-select" id="g-sala" name="s" defaultValue={comGraficos[0]!.slug}>
              {comGraficos.map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small" htmlFor="g-de">
              Data inicial
            </label>
            <input className="form-control" type="date" id="g-de" name="de" defaultValue={somarDias(hoje, -30)} max={hoje} required />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small" htmlFor="g-ate">
              Data final
            </label>
            <input className="form-control" type="date" id="g-ate" name="ate" defaultValue={hoje} max={hoje} required />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small" htmlFor="g-freq">
              Dados
            </label>
            <select className="form-select" id="g-freq" name="freq" defaultValue="diaria">
              <option value="diaria">Diários</option>
              <option value="mensal">Mensais</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small" htmlFor="g-tipo">
              Tipo de gráfico
            </label>
            <select className="form-select" id="g-tipo" name="tipo" defaultValue="linha">
              {Object.entries(TIPOS).map(([k, n]) => (
                <option key={k} value={k}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-auto ms-auto">
            <button className="btn btn-primary" type="submit">
              <i className="bi bi-arrow-right-circle me-1" /> Escolher séries
            </button>
          </div>
        </form>
      </section>

      {comGraficos.map((s) => (
        <section key={s.id} className="acesso-card mb-3">
          <h2 className="acesso-card__titulo">
            <i className="bi bi-collection" /> Outros gráficos — {s.sigla || s.nome}
          </h2>
          <div className="row g-3">
            {OUTROS.map(([titulo, descricao, icone, params]) => (
              <div key={params} className="col-md-6 col-xl-3">
                <Link className="acesso-link-card" href={`${base}?s=${s.slug}&${params}`}>
                  <i className={`bi ${icone}`} />
                  <span>
                    <strong>{titulo}</strong>
                    <small>{descricao}</small>
                  </span>
                </Link>
              </div>
            ))}
            {a.pode('criar_graficos', s.id) && (
              <div className="col-md-6 col-xl-3">
                <Link className="acesso-link-card" href={`/acesso/graficos/editar?sala=${s.id}`}>
                  <i className="bi bi-table" />
                  <span>
                    <strong>Gráfico livre</strong>
                    <small>Qualquer dado: digite ou cole a tabela (do Excel, por exemplo) e escolha o tipo de gráfico.</small>
                  </span>
                </Link>
              </div>
            )}
            <div className="col-md-6 col-xl-3">
              <Link className="acesso-link-card" href={`/acesso/graficos?sala=${s.id}`}>
                <i className="bi bi-images" />
                <span>
                  <strong>Gráficos da sala</strong>
                  <small>Os gráficos já salvos e as análises prontas desta sala.</small>
                </span>
              </Link>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}

export default async function Painel({ searchParams }: { searchParams: Promise<{ senha?: string; aba?: string }> }) {
  const a = await acl();
  const salas = await salasPainel(a);
  const { senha, aba: abaPedida } = await searchParams;
  const aba = abaPedida === 'graficos' ? 'graficos' : '';

  return (
    <>
      {senha === 'alterada' && <Mensagem tipo="sucesso">Senha alterada.</Mensagem>}
      <Cabecalho
        titulo={`Olá, ${a.usuario.nome.split(' ')[0]}`}
        subtitulo={a.globais.size > 0 ? 'Visão geral de todas as Salas de Situação.' : 'Visão geral das suas Salas de Situação.'}
      />

      {salas.length === 0 ? (
        <div className="acesso-card">
          <p className="mb-0 text-secondary">
            <i className="bi bi-info-circle" /> Você ainda não tem acesso a nenhuma Sala de Situação. Procure o administrador do sistema.
          </p>
        </div>
      ) : (
        <>
          <ul className="nav nav-tabs mb-4">
            {ABAS.map(([chave, rotulo, icone]) => (
              <li key={chave} className="nav-item">
                <Link className={`nav-link ${aba === chave ? 'active' : ''}`} aria-current={aba === chave ? 'page' : undefined} href={chave ? `/acesso?aba=${chave}` : '/acesso'}>
                  <i className={`bi ${icone} me-1`} /> {rotulo}
                </Link>
              </li>
            ))}
          </ul>

          {aba === 'graficos' ? (
            <CriarGraficos a={a} salas={salas} />
          ) : (
            <>
              <div className="acesso-salas mb-4">
                {salas.map((s) => (
                  <Link key={s.id} className="acesso-sala-card" style={corSala(s.cor)} href={`/acesso/salas/sala?s=${s.slug}`}>
                    <span className="acesso-sala-card__sigla">{s.sigla || s.nome}</span>
                    <strong>{s.nome}</strong>
                    <small>{s.perfilNome}</small>
                  </Link>
                ))}
              </div>
              <Indicadores a={a} salas={salas.map((s) => s.id)} salaId={null} />
            </>
          )}
        </>
      )}
    </>
  );
}
