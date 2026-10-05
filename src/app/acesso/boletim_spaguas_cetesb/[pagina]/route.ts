import { notFound } from 'next/navigation';
import { acl, exigirSala } from '@/lib/auth/acl';
import { PERMISSAO_CETESB, POSTOS_ESPERADOS, SALA_CETESB } from '@/lib/boletins-sala/rede-pluviometrica';
import { hojeSp } from '@/lib/integracoes/comum';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const BASE = '/acesso/boletim_spaguas_cetesb/assets';
// Muda quando o script/CSS muda, para o navegador não usar a cópia antiga.
const VERSAO = '20261005';

// Só recursos do próprio site (o script não é inline).
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; " +
  "font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";

/**
 * Sala CETESB — Rede Pluviométrica do Alto Tietê (dashboard_chuvas.php do
 * PHP, no mesmo endereço): acumulado mensal de todos os postos ativos do
 * SIBH, por sub-bacia, com exportação CSV. A página é só o esqueleto; os
 * dados vêm de api/chuvas_pontos.php e o script original os desenha.
 */
export async function GET(_: Request, { params }: { params: Promise<{ pagina: string }> }) {
  if ((await params).pagina !== 'dashboard_chuvas.php') notFound();
  await acl(); // login primeiro (redireciona para /acesso/login)
  const sala = await exigirSala(SALA_CETESB, PERMISSAO_CETESB); // 404 ou "sem acesso"

  const ano = Number(hojeSp().slice(0, 4));
  const meses = MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
  const anos = Array.from({ length: 11 }, (_, i) => `<option>${ano - i}</option>`).join('');
  const kpi = (cor: string, rotulo: string, id: string, detalhe: string) => `<article class="kpi ${cor}"><span>${rotulo}</span><strong id="${id}">--</strong>${detalhe}</article>`;
  const painel = (titulo: string, sub: string, resto = '') => `<div class="titulo"><div><h2>${titulo}</h2><span${sub}</span></div>${resto}</div>`;

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Rede Pluviométrica — Alto Tietê</title><link rel="stylesheet" href="${BASE}/css/dashboard_chuvas.css?v=${VERSAO}"></head>
<body><div class="dash-shell"><aside><div class="marca">SP<br><span>ÁGUAS</span></div><nav><a class="ativo" href="dashboard_chuvas.php" title="Chuvas">☂</a><a href="/acesso/salas/sala?s=${sala.slug}" title="Sala CETESB">⌂</a></nav></aside><main>
<header><div><p>SP-ÁGUAS · SALA DE SITUAÇÃO ALFREDO PISANI</p><h1>Rede Pluviométrica — Alto Tietê</h1><small>Cadastro dinâmico SIBH · ${POSTOS_ESPERADOS} postos ativos esperados</small></div><div class="filtros"><select id="dash-mes">${meses}</select><select id="dash-ano">${anos}</select><button id="dash-atualizar">Atualizar</button></div></header>
<div id="dash-loading" class="loading">Consultando cadastro e medições mensais do SIBH…</div><div id="dash-aviso" class="aviso oculto"></div>
<section class="kpis">
 ${kpi('azul', 'Postos ativos', 'kpi-total', `<small>esperados: ${POSTOS_ESPERADOS}</small>`)}${kpi('verde', 'Com dados', 'kpi-com-dados', '<small id="kpi-cobertura">--% de cobertura</small>')}${kpi('cinza', 'Sem dados', 'kpi-sem-dados', '<small>mantidos na rede</small>')}${kpi('amarelo', 'Média da bacia', 'kpi-media', '<small>mm · postos válidos</small>')}
 ${kpi('roxo', 'Mínima da bacia', 'kpi-minima', '<small id="kpi-posto-min">--</small>')}${kpi('ciano', 'Máxima da bacia', 'kpi-maxima', '<small id="kpi-posto-max">--</small>')}${kpi('laranja', 'Total da rede', 'kpi-soma', '<small>soma técnica · não representa a bacia</small>')}${kpi('azul', 'Lotes respondidos', 'kpi-lotes', '<small>falha isolada por lote</small>')}
</section>
<section class="painel">${painel('Acumulado mensal — todos os postos', '>Barras: acumulado por posto · linhas: média, mínima e máxima da bacia')}<div class="filtros-locais"><input id="filtro-busca" placeholder="Buscar código ou nome"><select id="filtro-subbacia"><option value="">Todas as sub-bacias</option></select><select id="filtro-situacao"><option value="">Todas as situações</option><option value="completo">Completo</option><option value="parcial">Parcial</option><option value="sem_dados">Sem dados</option></select><button id="limpar-filtros">Limpar</button></div><div class="legenda-sem-dados"><i></i> Sem dados <b></b> Acumulado igual a 0 mm</div><div class="chart-scroll"><div id="chart-geral-box"><canvas id="chart-geral"></canvas></div></div><div id="chart-contagem" class="nota"></div></section>
<section class="grade-dois"><article class="painel">${painel('Comparativo entre sub-bacias', '>Média, mínima, máxima e cobertura')}<div class="chart-fixo"><canvas id="chart-comparativo"></canvas></div></article><article class="painel">${painel('Detalhe por sub-bacia', ' id="sub-contagem">Todos os postos', '<select id="seletor-subgrafico"></select>')}<div class="chart-fixo"><canvas id="chart-sub"></canvas></div></article></section>
<section class="painel">${painel('Indicadores por sub-bacia', '>Total, válidos, cobertura e extremos')}<div class="table-wrap"><table><thead><tr><th>Sub-bacia</th><th>Total</th><th>Com dados</th><th>Sem dados</th><th>Cobertura</th><th>Média</th><th>Mínima / posto</th><th>Máxima / posto</th><th>Total da rede</th></tr></thead><tbody id="tbody-subbacias"></tbody></table></div></section>
<section class="painel">${painel('Tabela completa da rede', ' id="tabela-contagem">--', '<a id="exportar-csv" class="botao" href="#">Exportar CSV</a>')}<div class="table-wrap tabela-postos"><table><thead><tr><th data-sort="codigo">Código</th><th data-sort="nome">Nome</th><th>Município</th><th>Sub-bacia</th><th>Coordenadas</th><th>Posto</th><th data-sort="acumulado_mensal">Acumulado</th><th>Maior diária</th><th>Dias</th><th>Registros</th><th data-sort="situacao_dados">Dados</th></tr></thead><tbody id="tbody-postos"></tbody></table></div><div class="paginacao"><button id="pag-anterior">Anterior</button><span id="pag-info">--</span><button id="pag-proxima">Próxima</button><select id="pag-tamanho"><option>25</option><option>50</option><option>100</option></select></div></section>
</main></div><script src="/acesso/vendor/chartjs/chart.umd.min.js"></script><script src="${BASE}/js/dashboard_chuvas.js?v=${VERSAO}"></script></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP, 'Cache-Control': 'private, no-store' } });
}
