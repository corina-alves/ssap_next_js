import Link from 'next/link';
import { Suspense } from 'react';
import '@/styles/legado/estilo-inicio.css';
import '@/styles/legado/index.css';
import '@/styles/legado/index-inline.css';
import { GraficoCantareiraHome, GraficoResumoSistemas } from '@/components/graficos-php';
import { texto } from '@/components/paginacao';
import { SelectAutoEnvio } from '@/components/site/auto-envio';
import { dataBr, dataHora } from '@/lib/formato';
import { localizarMunicipio } from '@/lib/hidrologia/previsao';
import { painelReservatorios, serieAnual } from '@/lib/hidrologia/reservatorios';
import { municipiosSP } from '@/lib/integracoes/ibge';
import { previsaoMunicipio, previsaoSistemas } from '@/lib/integracoes/openmeteo';
import { ID_CANTAREIRA } from '@/lib/integracoes/sabesp';
import { chuvaAgora } from '@/lib/integracoes/sibh';

/** Página inicial — mesma estrutura do index.php do site PHP. */

const fmt = (v: number | null | undefined, casas = 1, suf = '') =>
  v === null || v === undefined ? '—' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}${suf}`;
const soma = (vs: (number | null)[], n: number) => vs.slice(0, n).reduce<number>((s, v) => s + (v ?? 0), 0);

const ACESSO_RAPIDO = [
  { href: '/monitoramento_hidrologico', cor: 'card-blue', icone: 'bi-broadcast-pin', titulo: 'Monitoramento', texto: 'Rede de chuvas, rios, níveis e vazões.' },
  { href: '/reservatorios', cor: 'card-cyan', icone: 'bi-droplet-half', titulo: 'Reservatórios', texto: 'Volumes, descargas e curvas operacionais.' },
  { href: '/precipitacao', cor: 'card-green', icone: 'bi-cloud-rain-heavy', titulo: 'Precipitação', texto: 'Chuva observada nos sistemas produtores.' },
  { href: '/vazao', cor: 'card-orange', icone: 'bi-water', titulo: 'Vazões', texto: 'Vazão natural, afluência e médias históricas.' },
  { href: '/protocolo_escassez', cor: 'card-purple', icone: 'bi-shield-exclamation', titulo: 'Escassez Hídrica', texto: 'Estágios, indicadores e ações de contingência.' },
  { href: 'https://hidroapp.spaguas.sp.gov.br/', cor: 'card-red', icone: 'bi-bar-chart-line', titulo: 'HidroApp', texto: 'Indicadores para apoio à gestão hídrica.', externo: true },
];

const SALAS = [
  { href: '/', img: 'sssp.jpg', tag: 'Estadual', titulo: 'Sala de Situação Alfredo Pisani', texto: 'Monitoramento das condições hidrológicas do Sistema Cantareira e dos principais sistemas produtores metropolitanos e redes telemétricas de chuvas, níveis e vazões do Estado de São Paulo.' },
  { href: 'https://www.sspcj.org.br/', img: 'piracicaba.jpg', tag: 'Bacias PCJ', titulo: 'Sala de Situação PCJ', texto: 'Monitoramento das condições hidrológicas das Bacias dos rios Piracicaba, Capivari e Jundiaí.', externo: true },
  { href: 'https://salasituacaohidrobs.com.br/agem-painel/mapa', img: 'sala_nph.png', tag: 'Baixada Santista', titulo: 'Sala de Situação Baixada Santista', texto: 'Acompanhamento de chuvas, níveis e vazões dos principais rios da Região Metropolitana da Baixada Santista.', externo: true },
  { href: '/boletins/ribeira', img: 'outorga.jpg', tag: 'Vale do Ribeira', titulo: 'Sala de Situação Vale do Ribeira', texto: 'Integração de dados e acompanhamento das condições hidrológicas da região do Vale do Ribeira.' },
];

const DESTAQUES = [
  { href: 'https://apps.spaguas.sp.gov.br/sibh/chuva_agora/', img: 'chuvaagora.png', titulo: 'Chuva Agora', texto: 'Monitoramento em tempo real das chuvas registradas no Estado.', externo: true },
  { href: 'https://hidroapp.spaguas.sp.gov.br/', img: 'hidroapp.png', titulo: 'HidroApp', texto: 'Indicadores de disponibilidade, clima e vulnerabilidade hídrica.', externo: true },
  { href: 'https://www.saisp.br/estaticos/sitenovo/home.html', img: null, titulo: 'Radar SP Águas', texto: 'Acompanhamento meteorológico e radar de Ponte Nova.', externo: true },
  { href: '/protocolo_escassez', img: 'protocolo_escassez.png', titulo: 'Protocolo de Escassez', texto: 'Consulte o enquadramento e as medidas previstas para cada estágio.' },
];

function Atalho({ href, externo, className, style, children }: { href: string; externo?: boolean; className: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return externo ? (
    <a href={href} target="_blank" rel="noopener" className={className} style={style}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------

async function CartaoPrevisao({ municipio }: { municipio: string }) {
  const local = await localizarMunicipio(municipio);
  if (!local.ok) return <div className="alert alert-warning mt-3 mb-0">{local.mensagem}</div>;
  const r = await previsaoMunicipio(local.local.lat, local.local.lon);
  if (!r.ok) return <div className="alert alert-warning mt-3 mb-0">Não foi possível carregar a previsão deste município.</div>;
  const hoje = r.dados.dias[0];
  return (
    <>
      <h2>{local.local.nome}</h2>
      <p className="text-secondary">{hoje ? dataBr(hoje.data) : ''}</p>
      <div className="valor-chuva mt-4">🌧️ {fmt(hoje?.chuvaMm)} mm</div>
      <p className="mt-3 text-secondary">Acumulado previsto para o dia.</p>
      <div className="temperaturas">
        <div className="temp-box">
          <small>Temperatura Máxima</small>
          <strong>☀️ {fmt(hoje?.tmax, 1, '°C')}</strong>
        </div>
        <div className="temp-box">
          <small>Temperatura Mínima</small>
          <strong>🌙 {fmt(hoje?.tmin, 1, '°C')}</strong>
        </div>
      </div>
    </>
  );
}

async function ChuvaAgora() {
  const r = await chuvaAgora(0.2);
  const cabeca = (titulo: string, sub: string, selo: string) => (
    <div className="sibh-now-head">
      <div className="sibh-now-title">
        <div className="sibh-now-icon">
          <i className="bi bi-cloud-rain-heavy" />
        </div>
        <div>
          <h3>{titulo}</h3>
          <p>{sub}</p>
        </div>
      </div>
      <span className="sibh-live">{selo}</span>
    </div>
  );
  if (!r.ok) {
    return (
      <div className="sibh-now-panel">
        {cabeca('Monitoramento pluviométrico SIBH', 'Última 1 hora', 'SIBH')}
        <div className="sibh-error">
          <i className="bi bi-cloud-slash fs-3 d-block mb-2" />
          {r.mensagem}
        </div>
      </div>
    );
  }
  const c = r.dados;
  return (
    <div className="sibh-now-panel">
      {cabeca('Monitoramento pluviométrico em tempo real', 'Última 1 hora · SIBH / SP-Águas', r.desatualizado ? 'Últimos dados obtidos' : 'Dados observados')}
      <div className="sibh-now-body">
        <div className="sibh-metrics">
          <div className="sibh-metric is-rain">
            <small>Maior chuva registrada</small>
            <strong>{fmt(c.maximaMm)} mm</strong>
            <span>maior valor entre os postos com leitura</span>
          </div>
          <div className="sibh-metric">
            <small>Chuva média da rede</small>
            <strong>{fmt(c.mediaMm)} mm</strong>
            <span>média das leituras válidas</span>
          </div>
          <div className="sibh-metric is-green">
            <small>Postos com chuva</small>
            <strong>{c.postosComChuva.toLocaleString('pt-BR')}</strong>
            <span>postos com valor acima de 0,2 mm</span>
          </div>
          <div className="sibh-metric">
            <small>Postos com leitura</small>
            <strong>{c.postosMonitorados.toLocaleString('pt-BR')}</strong>
            <span>leituras válidas recebidas do SIBH</span>
          </div>
        </div>
        <div className="sibh-detail-grid">
          <div className="sibh-top">
            <div className="sibh-top-head">
              <strong> TOP 5 DA ÚLTIMA 1 HORA </strong>
              <small className="text-secondary">mm</small>
            </div>
            <ul className="sibh-top-list">
              {c.maiores.length ? (
                c.maiores.map((p, i) => (
                  <li key={p.prefixo}>
                    <div className="sibh-station">
                      <strong>
                        {i + 1}. {p.nome}
                      </strong>
                      <small>{p.municipio ?? p.prefixo}</small>
                    </div>
                    <div className="sibh-rain-value">{fmt(p.chuvaMm)} mm</div>
                  </li>
                ))
              ) : (
                <li>
                  <div className="sibh-station">
                    <strong>Nenhuma chuva acima de 0,2 mm.</strong>
                    <small> Nenhuma estação registrou volume significativo de chuva na última hora.</small>
                  </div>
                </li>
              )}
            </ul>
          </div>
          <div className="sibh-summary">
            <div>
              <div className="sibh-summary-icon">
                <i className="bi bi-activity" />
              </div>
              <h4>
                {c.postosComChuva > 0
                  ? 'Há registro de chuva na rede hidrometeorológica do Sistema Integrado de Bacias Hidrográficas (SIBH).'
                  : 'Sem chuva significativa na última hora na rede do SIBH.'}
              </h4>
              <p>
                Este resumo é calculado com as leituras disponibilizadas pelo SIBH. Para mapa, localização e detalhes de cada posto,
                consulte o Chuva Agora.
              </p>
            </div>
            <p style={{ textAlign: 'center' }}>
              <a className="btn btn-sm btn-success" target="_blank" rel="noopener" href="https://apps.spaguas.sp.gov.br/sibh/chuva_agora/">
                <i className="bi bi-map me-1" /> Acessar Chuva Agora
              </a>
            </p>
          </div>
        </div>
        <div className="sibh-updated">
          <i className="bi bi-clock me-1" />
          Atualizado em {dataHora(r.obtidoEm)}. Dados do SIBH atualizados a cada 10 minutos.
        </div>
      </div>
    </div>
  );
}

async function AcompanhamentoVolume() {
  const r = await painelReservatorios();
  if (!r.ok) return <div className="alert alert-warning">{r.mensagem}</div>;
  const d = r.dados;
  const serie = await serieAnual(d.dataUsada, ID_CANTAREIRA);
  return (
    <div className="row g-3 align-items-stretch">
      <div className="col-xl-3 col-lg-4">
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <i className="bi bi-bar-chart-fill" />
              <h3>Principais Sistemas</h3>
            </div>
          </div>
          <div className="dashboard-card-body">
            <div className="resumo-chart-intro">
              <strong>Volume útil atual</strong>
              <small>Comparativo dos volumes úteis atuais dos principais sistemas metropolitanos.</small>
            </div>
            <div className="grafico-resumo-wrapper">
              <GraficoResumoSistemas cantareira={d.cantareira?.volume ?? null} altoTiete={d.altoTiete?.volume ?? null} sim={d.sim?.volume ?? null} />
            </div>
            <div className="resumo-atualizacao">Dados de {dataBr(d.dataUsada)}</div>
          </div>
        </div>
      </div>
      <div className="col-xl-9 col-lg-8">
        <div className="dashboard-card-cantareira">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <i className="bi bi-graph-up" />
              <h3>Evolução do Volume - Cantareira</h3>
            </div>
            <span className="badge rounded-pill text-bg-light">Histórico comparativo</span>
          </div>
          <div className="dashboard-card-body chart-area">
            <GraficoCantareiraHome pontos={serie.map((p) => ({ ano: p.ano, volume: p.volume }))} />
            <div className="chart-footer">
              <small>Valores referentes ao mesmo dia e mês de cada ano.</small>
              <Link href="/reservatorios" className="btn btn-sm btn-outline-primary px-3">
                Ver reservatórios
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function PrevisaoSistemas() {
  const r = await previsaoSistemas(7);
  if (!r.ok) return <div className="col-12 text-center text-secondary py-4">{r.mensagem}</div>;
  return (
    <>
      {r.dados.map((s) => {
        const hoje = s.chuvaMm[0] ?? null;
        return (
          <div className="col-lg-3 col-md-4 col-sm-6" key={s.sistema}>
            <Link href="/previsao-reservatorios" className={`previsao-card text-center d-block text-decoration-none${s.sistema === 'Cantareira' ? ' cantareira' : ''}`}>
              <h5>{s.sistema}</h5>
              <div className="display-5 my-3" aria-hidden>
                {(hoje ?? 0) >= 5 ? '🌧️' : '⛅'}
              </div>
              <strong className="text-info">{fmt(hoje)} mm</strong>
              <br />
              <small className="text-secondary">Chuva hoje</small>
              <hr />
              <small>
                Próx. 72h: <strong>{fmt(soma(s.chuvaMm, 3))} mm</strong>
              </small>
              <br />
              <small>
                Prob. chuva: <strong>{fmt(s.probabilidade[0] ?? null, 0, '%')}</strong>
              </small>
              <br />
              <small>
                🌙 {fmt(s.tmin[0] ?? null, 1, '°C')} | ☀️ {fmt(s.tmax[0] ?? null, 1, '°C')}
              </small>
            </Link>
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------

export default async function Inicio({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const municipio = texto((await searchParams).municipio, 80) || 'São Paulo';
  const lista = await municipiosSP();

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-lg-7">
              <div className="hero-content">
                <div className="hero-tag">
                  <i className="bi bi-broadcast-pin" />
                  Monitoramento hidrológico e meteorológico
                </div>
                <h1>
                  Sala de Situação
                  <span>Alfredo Pisani</span>
                </h1>
                <p>
                  Informações integradas sobre chuvas, vazões, níveis, reservatórios e condições meteorológicas para apoiar o
                  acompanhamento e a tomada de decisão na gestão dos recursos hídricos do Estado de São Paulo.
                </p>
                <div className="hero-actions">
                  <a href="https://apps.spaguas.sp.gov.br/sibh/chuva_agora/" target="_blank" rel="noopener" className="btn btn-primary">
                    <i className="bi bi-cloud-rain-heavy me-2" />
                    Chuva Agora
                  </a>
                  <a href="#painel" className="btn btn-outline-light">
                    <i className="bi bi-grid me-2" />
                    Ver painel
                  </a>
                </div>
              </div>
            </div>
            <div className="col-lg-5">
              <div className="hero-weather-card">
                <div className="hero-weather-header">
                  <div className="hero-weather-icon">
                    <i className="bi bi-geo-alt-fill" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', color: '#063669', fontWeight: 800 }}>Previsão meteorológica</h2>
                  </div>
                </div>
                <form method="get">
                  <label htmlFor="municipioSelectHero" className="form-label">
                    Selecione o município
                  </label>
                  <SelectAutoEnvio id="municipioSelectHero" name="municipio" defaultValue={municipio} className="form-select hero-municipio-select">
                    {(lista.ok ? lista.dados.map((m) => m.nome) : ['São Paulo']).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </SelectAutoEnvio>
                  <noscript>
                    <button type="submit" className="btn btn-sm btn-primary mt-2">
                      Ver
                    </button>
                  </noscript>
                </form>
                <div id="boxPrevisaoMunicipioHero">
                  <Suspense fallback={<div className="text-secondary py-4 text-center">Carregando previsão...</div>}>
                    <CartaoPrevisao municipio={municipio} />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="main-area" id="painel">
        <div className="container">
          <section className="mb-5">
            <div className="section-head">
              <div>
                <h2>Acesso rápido</h2>
                <p>Principais áreas de consulta e acompanhamento.</p>
              </div>
            </div>
            <div className="row row-cols-2 row-cols-md-3 row-cols-xl-6 g-3">
              {ACESSO_RAPIDO.map((a) => (
                <div className="col" key={a.titulo}>
                  <Atalho href={a.href} externo={a.externo} className={`quick-card ${a.cor} d-block`}>
                    <div className="quick-icon">
                      <i className={`bi ${a.icone}`} />
                    </div>
                    <strong>{a.titulo}</strong>
                    <p>{a.texto}</p>
                    <span className="quick-arrow">
                      <i className="bi bi-arrow-right" />
                    </span>
                  </Atalho>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-5 sibh-now-section" id="chuva-agora-sibh">
            <div className="section-head">
              <div>
                <h2>Chuva Agora</h2>
                <p>Leituras observadas na rede pluviométrica da SP-Águas na última hora.</p>
              </div>
            </div>
            <Suspense fallback={<div className="sibh-now-panel"><div className="sibh-now-body"><div className="sibh-metrics"><div className="sibh-skeleton" /><div className="sibh-skeleton" /><div className="sibh-skeleton" /><div className="sibh-skeleton" /></div></div></div>}>
              <ChuvaAgora />
            </Suspense>
          </section>

          <section className="mb-5">
            <div className="section-head">
              <div>
                <h2>Acompanhamento de Volume</h2>
                <p>Evolução do Cantareira e documentos de referência.</p>
              </div>
            </div>
            <Suspense fallback={<div className="text-secondary py-4 text-center">Carregando dados...</div>}>
              <AcompanhamentoVolume />
            </Suspense>
          </section>

          <section className="systems-wrap" id="sistemas">
            <div className="section-head">
              <div>
                <h2>Previsão dos Sistemas Produtores</h2>
                <p>Chuva, probabilidade e temperatura nas áreas de influência da RMSP.</p>
              </div>
              <a href="https://sssp.spaguas.sp.gov.br/ssdsp/" className="btn btn-sm btn-primary p-2" target="_blank" rel="noopener">
                Acessar SSD
                <i className="bi bi-box-arrow-up-right ms-1" />
              </a>
            </div>
            <div className="row g-3">
              <Suspense fallback={<div className="col-12 text-center text-secondary py-4">Carregando previsão dos sistemas produtores...</div>}>
                <PrevisaoSistemas />
              </Suspense>
            </div>
          </section>

          <section className="salas-section">
            <div className="section-head">
              <div>
                <h2>Salas de Situação</h2>
                <p>Parcerias regionais para monitoramento e acompanhamento das condições hídricas.</p>
              </div>
            </div>
            <div className="row g-4">
              {SALAS.map((s) => (
                <div className="col" key={s.titulo}>
                  <Atalho href={s.href} externo={s.externo} className="sala-card" style={{ backgroundImage: `url('/legado/img/${s.img}')` }}>
                    <div className="sala-card-content">
                      <span className="sala-card-tag">
                        <i className="bi bi-geo-alt" />
                        {s.tag}
                      </span>
                      <h3>{s.titulo}</h3>
                      <p>{s.texto}</p>
                      <span className="sala-card-link">
                        Acessar sala
                        <i className="bi bi-arrow-up-right" />
                      </span>
                    </div>
                  </Atalho>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <div className="section-head">
              <div>
                <h2>Acompanhamento das FAIXAS de atuação</h2>
                <p>
                  <strong>SP-Águas e Arsesp:</strong> Integração de dados e acompanhamento das condições hidrológicas.
                </p>
              </div>
            </div>
            <div className="row g-3">
              <div className="col">
                <a
                  href="https://app.powerbi.com/view?r=eyJrIjoiNzE3NGY2ZGQtYjc1OC00ZThiLTgxZDgtMDhlZDQ1OTM0YmI2IiwidCI6IjNhNzhiMGNkLTdjOGUtNDkyOS04M2Q1LTE5MGE2Y2MwMTM2NSJ9"
                  target="_blank"
                  rel="noopener"
                  className="sala-card"
                  style={{ backgroundImage: "url('/legado/img/curva_contingencia.png')" }}
                >
                  <div className="sala-card-content">
                    <span className="sala-card-tag">
                      <i className="bi bi-geo-alt" />
                      SP-Águas e Arsesp
                    </span>
                    <h3>Painel de Acompanhamento das FAIXAS</h3>
                    <p>Acompanhamento das faixas de atuação e das condições hidrológicas dos Sistemas de Abastecimento.</p>
                    <span className="sala-card-link">
                      Acessar Painel
                      <i className="bi bi-arrow-up-right" />
                    </span>
                  </div>
                </a>
              </div>
            </div>
          </section>

          <section className="mt-5">
            <div className="section-head">
              <div>
                <h2>Destaques e serviços</h2>
                <p>Acesso a produtos e plataformas de monitoramento.</p>
              </div>
            </div>
            <div className="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3">
              {DESTAQUES.map((d) => (
                <div className="col" key={d.titulo}>
                  <Atalho href={d.href} externo={d.externo} className="highlight-card" style={d.img ? { backgroundImage: `url('/legado/img/${d.img}')` } : undefined}>
                    <div>
                      <h3>{d.titulo}</h3>
                      <p>{d.texto}</p>
                    </div>
                  </Atalho>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
