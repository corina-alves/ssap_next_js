import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
// Next 16.3.8 ainda exporta o nome anterior para a ferramenta de teste de proxy.
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import nextConfig from '../next.config';
import { config, proxy } from '../src/proxy';

function producao(acao: () => void) {
  const anterior = { NODE_ENV: process.env.NODE_ENV, APP_URL: process.env.APP_URL };
  Object.assign(process.env, { NODE_ENV: 'production', APP_URL: 'https://example.org/ssap' });
  try { acao(); } finally {
    for (const [chave, valor] of Object.entries(anterior)) {
      if (valor === undefined) Reflect.deleteProperty(process.env, chave);
      else Reflect.set(process.env, chave, valor);
    }
  }
}

test('proxy CSRF cobre a API sob /ssap e preserva páginas e assets', () => {
  assert.ok(unstable_doesMiddlewareMatch({ config, nextConfig, url: '/ssap/api/acesso/boletim_integrado/edicao' }));
  for (const url of ['/api/acesso/boletim_integrado/edicao', '/ssap/acesso/login', '/ssap/acesso/vendor/leaflet/leaflet.js', '/ssap/_next/static/app.js']) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig, url }), false, url);
  }
});

test('escrita API exige a origem HTTPS configurada, mesmo com forwarded-host forjado', () => producao(() => {
  const requisicao = (origin?: string) => new NextRequest('http://localhost:3000/ssap/api/acesso/boletim_integrado/edicao', {
    method: 'POST', headers: { ...(origin ? { origin } : {}), 'x-forwarded-host': 'malicioso.example.org' },
  });
  assert.equal(proxy(requisicao('https://example.org')).status, 200);
  for (const origin of [undefined, 'null', 'https://malicioso.example.org', 'http://example.org', 'https://example.org:8443']) {
    assert.equal(proxy(requisicao(origin)).status, 403, String(origin));
  }
}));

test('sem APP_URL produção recusa escrita e mantém GET disponível', () => producao(() => {
  Reflect.deleteProperty(process.env, 'APP_URL');
  assert.equal(proxy(new NextRequest('http://localhost:3000/ssap/api/acesso/boletim_integrado/edicao', { method: 'POST', headers: { origin: 'http://localhost:3000' } })).status, 403);
  assert.equal(proxy(new NextRequest('http://localhost:3000/ssap/api/saude')).status, 200);
}));
