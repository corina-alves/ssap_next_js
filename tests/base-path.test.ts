import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASE_PATH, comBasePath, htmlComBasePath } from '../src/lib/base-path';
import boletimPcj from '../src/conteudo/legado/boletim_pcj';
import monitoramento from '../src/conteudo/legado/monitoramento_hidrologico';
import notaInformativa from '../src/conteudo/legado/nota_informativa';

test('URLs nativas de API, download e assets conservam query e recebem /ssap uma vez', () => {
  assert.equal(BASE_PATH, '/ssap');
  for (const caminho of ['/api/acesso/boletim_integrado/edicao', '/boletins/arquivo/15?baixar=1', '/legado/img/hero.jpg', '/acesso/defesa_civil#chuva']) {
    const esperado = `/ssap${caminho}`;
    assert.equal(comBasePath(caminho), esperado);
    assert.equal(comBasePath(esperado), esperado);
  }
  assert.equal(comBasePath('/'), '/ssap/');
  assert.equal(comBasePath('/ssap?aba=boletins'), '/ssap?aba=boletins');
  assert.equal(comBasePath('/ssap-outra'), '/ssap/ssap-outra');
});

test('URLs externas, blobs, caminhos relativos e âncoras conservam seu destino', () => {
  for (const url of ['https://apps.spaguas.sp.gov.br/sibh/api/v2/', '//cdn.example.org/app.js', 'mailto:sala@example.org', 'data:image/png;base64,abc', 'blob:https://example.org/id', '#art-2', '?data=2026-10-13', 'img/spaguas.png']) {
    assert.equal(comBasePath(url), url);
  }
});

test('HTML de boletim adapta assets, formulário, dados API, CSS e script sem mudar destinos externos', () => {
  const html = `<form action="/acesso/boletins"><img src='/legado/Portaria 3373.pdf'>
<a href="/boletins/arquivo/3?baixar=1">PDF</a><a href="#quadro">Quadro</a>
<a href="https://example.org/arquivo">Fonte</a><script src="//cdn.example.org/app.js"></script>
<body data-dados="/api/acesso/boletim_pcj/dados"><style>.capa{background:url('/legado/img/hero.jpg')}</style>
<script>fetch('/api/acesso/boletim_integrado/edicao'); fetch('https://example.org/api/externa');</script>`;
  const resultado = htmlComBasePath(html);
  for (const esperado of ['action="/ssap/acesso/boletins"', "src='/ssap/legado/Portaria 3373.pdf'", 'href="/ssap/boletins/arquivo/3?baixar=1"', 'data-dados="/ssap/api/acesso/boletim_pcj/dados"', "url('/ssap/legado/img/hero.jpg')", "fetch('/ssap/api/acesso/boletim_integrado/edicao')", 'href="#quadro"', 'href="https://example.org/arquivo"', 'src="//cdn.example.org/app.js"', "fetch('https://example.org/api/externa')"]) {
    assert.ok(resultado.includes(esperado), esperado);
  }
  assert.equal(htmlComBasePath(resultado), resultado);
});

test('documentos legados reais não apontam assets e PDFs para a raiz do domínio', () => {
  for (const documento of [boletimPcj, monitoramento, notaInformativa]) {
    const html = htmlComBasePath(documento);
    assert.ok(html.includes('/ssap/legado/') || html.includes('/ssap/acesso/'));
    assert.doesNotMatch(html, /(?:src|href)=["']\/(?:legado|acesso)\//);
    assert.equal(htmlComBasePath(html), html);
  }
});
