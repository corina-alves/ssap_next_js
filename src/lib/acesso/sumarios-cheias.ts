import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium, type Browser } from 'playwright';
import type { Acl } from '../auth/acl';
import { query } from '../db';
import { lembrar } from '../integracoes/cache';
import { buscarJson } from '../integracoes/http';
import { absoluto } from '../storage';
import { criarFilaCapturas, type FilaCapturas } from './fila-capturas';

/**
 * Sumários Executivos de Cheias (porte de acesso/sumario_executivo_cheias do
 * PHP): o HTML original é servido sem alteração depois do login, e o
 * JavaScript dele chama, na mesma pasta, o proxy do SIBH e a captura do
 * diagrama. Os dois ficam na área da Sala Alfredo Pisani; o do Ribeira também
 * pode ser feito pela sala Ribeira.
 */
export const SUMARIOS = {
  ribeira_iguape: {
    salas: ['alfredo-pisani', 'ribeira'],
    diagrama: { url: 'https://apps.spaguas.sp.gov.br/sibh/diagramas/tiete_pinheiros/?vw=flow&dg=ribeira-iguape&bs=gigante', altura: 1150 },
  },
  tiete_pinheiros: {
    salas: ['alfredo-pisani'],
    diagrama: { url: 'https://apps.spaguas.sp.gov.br/sibh/diagramas/tiete_pinheiros/?vw=flow&dg=tiete-pinheiros&bf=completo&bs=medio', altura: 1048 },
  },
} as const;
export type ChaveSumario = keyof typeof SUMARIOS;

/** Tem criar_boletim em alguma das salas (ativas)? */
export async function podeSumario(a: Acl, salas: readonly string[]): Promise<boolean> {
  const linhas = await query<{ id: number }>(`SELECT id FROM salas WHERE slug = ANY($1::text[]) AND status = 'ativa' AND excluido_em IS NULL`, [[...salas]]);
  return linhas.some((s) => a.pode('criar_boletim', s.id));
}

export const SALAS_SUMARIOS = [...new Set(Object.values(SUMARIOS).flatMap((s) => s.salas))];

// ---------------------------------------------------------------------------
// Proxy do SIBH (api_proxy.php)
// ---------------------------------------------------------------------------

const API_V2 = 'https://apps.spaguas.sp.gov.br/sibh/api/v2/';
const API_V1 = 'https://apps.spaguas.sp.gov.br/sibh/api/v1/'; // comportas das barragens
const CAMINHOS_V2 = ['measurements', 'measurements/now', 'parameters'];
const CAMINHOS_V1 = ['dams'];

/**
 * Repassa uma consulta à API pública do SIBH (só os caminhos permitidos), com
 * cache curto: o sumário pede os dados com a hora exata, então as datas são
 * arredondadas para 5 min — reabrir o sumário no mesmo intervalo usa a
 * resposta guardada. Cotas (parameters) mudam raramente: 24 h.
 */
export async function proxySibh(parametros: URLSearchParams): Promise<Response> {
  const caminho = (parametros.get('path') ?? '').trim();
  const v1 = CAMINHOS_V1.includes(caminho);
  if (!v1 && !CAMINHOS_V2.includes(caminho)) {
    return Response.json({ error: "Parametro 'path' invalido ou ausente.", permitidos: [...CAMINHOS_V2, ...CAMINHOS_V1] }, { status: 400 });
  }
  const partes: string[] = [];
  for (let [chave, valor] of parametros) {
    if (chave === 'path') continue;
    if (chave === 'start_date' || chave === 'end_date') {
      const t = Date.parse(valor);
      if (!Number.isNaN(t)) valor = `${new Date(Math.floor(t / 300_000) * 300_000).toISOString().slice(0, 16)}:00Z`;
    }
    // "chave[]=valor" (station_prefix_ids[], parameterizable_ids[]) vai com os colchetes literais
    const lista = chave.endsWith('[]');
    if (lista) chave = chave.slice(0, -2);
    partes.push(`${encodeURIComponent(chave)}${lista ? '[]' : ''}=${encodeURIComponent(valor)}`);
  }
  const url = `${v1 ? API_V1 : API_V2}${caminho}${partes.length ? `?${partes.join('&')}` : ''}`;

  const r = await lembrar('sibh_sumario', createHash('sha256').update(url).digest('hex'), caminho === 'parameters' ? 86_400 : 300, () =>
    buscarJson(url, { timeoutMs: 30_000 }),
  );
  if (!r) return Response.json({ error: 'Falha ao contatar a API do SIBH.' }, { status: 502 });
  return Response.json(r.valor, { headers: { 'Cache-Control': 'private, no-store' } });
}

// ---------------------------------------------------------------------------
// Captura do diagrama (capturar_diagrama*.php + capture_diagrama*.js)
// ---------------------------------------------------------------------------

const arquivoCaptura = (chave: ChaveSumario) => absoluto(`sumarios/diagrama_${chave}.png`);

type Resultado = { success: true; path: string; geradoEm: string } | { success: false; error: string };
type Captura = { success: true; geradoEm: string } | { success: false; error: string };

const CACHE_CAPTURA_MS = 5 * 60_000;
const PRAZO_CAPTURA_MS = 75_000;
// Compartilha a fila mesmo com recargas em desenvolvimento ou módulos de rotas diferentes.
const estado = globalThis as typeof globalThis & { __ssapFilaCapturas?: FilaCapturas<ChaveSumario, Captura> };
const fila = (estado.__ssapFilaCapturas ??= criarFilaCapturas<ChaveSumario, Captura>(['tiete_pinheiros', 'ribeira_iguape']));

async function capturaRecente(destino: string): Promise<string | null> {
  try {
    const s = await stat(/*turbopackIgnore: true*/ destino);
    const idade = Date.now() - s.mtimeMs;
    return s.isFile() && s.size > 0 && idade >= 0 && idade < CACHE_CAPTURA_MS ? s.mtime.toISOString() : null;
  } catch {
    return null;
  }
}

/**
 * Screenshot colorido do diagrama ao vivo do SIBH, para o PDF (o iframe ao
 * vivo imprime com as cores clareadas pelo @media print da página do SIBH).
 * O Docker instala Playwright e Chromium. Reaproveita a captura por cinco minutos,
 * agrupa pedidos iguais e executa somente um navegador por processo da aplicação.
 */
export async function capturarDiagrama(chave: ChaveSumario, rota: string): Promise<Resultado> {
  if (!Object.hasOwn(SUMARIOS, chave)) return { success: false, error: 'Captura inválida.' };
  const captura = await fila.executar(chave, () => gerarCaptura(chave));
  return captura.success ? { ...captura, path: `${rota}?img=1` } : captura;
}

async function gerarCaptura(chave: ChaveSumario): Promise<Captura> {
  const { url, altura } = SUMARIOS[chave].diagrama;
  const destino = arquivoCaptura(chave);
  const recente = await capturaRecente(destino);
  if (recente) return { success: true, geradoEm: recente };

  const temporario = `${destino}.${randomBytes(8).toString('hex')}.tmp`;
  const prazo = Date.now() + PRAZO_CAPTURA_MS;
  const restante = (maximo: number) => {
    const ms = prazo - Date.now();
    if (ms <= 0) throw new Error('Prazo de captura esgotado.');
    return Math.min(maximo, ms);
  };
  let navegador: Browser | undefined;
  const cancelar = setTimeout(() => { void navegador?.close().catch(() => {}); }, PRAZO_CAPTURA_MS);
  cancelar.unref();
  try {
    await mkdir(/*turbopackIgnore: true*/ dirname(destino), { recursive: true });
    // URLs fixas do SIBH; preserva também a sandbox do Chromium para conteúdo externo.
    navegador = await chromium.launch({ chromiumSandbox: true, timeout: restante(15_000) });
    const pagina = await navegador.newPage({ viewport: { width: 1700, height: altura } });
    pagina.setDefaultTimeout(restante(10_000));
    await pagina.goto(url, { waitUntil: 'load', timeout: restante(30_000) });
    // espera a rede ficar ociosa (todas as leituras já carregadas e coloridas) e dá uma margem
    // para a última leva de cores; segue mesmo se ainda houver alguma requisição pendente
    await pagina.waitForLoadState('networkidle', { timeout: restante(20_000) }).catch(() => {});
    await pagina.waitForTimeout(restante(6000));
    // recorta só a barra de menu do site (mantém a barra do diagrama e a legenda do rodapé)
    const png = await pagina.screenshot({ type: 'png', clip: { x: 0, y: 64, width: 1700, height: altura - 64 }, timeout: restante(10_000) });
    restante(1);
    // O leitor continua vendo a captura anterior até a nova estar inteiramente gravada.
    await writeFile(/*turbopackIgnore: true*/ temporario, png, { flag: 'wx', mode: 0o640 });
    await rename(/*turbopackIgnore: true*/ temporario, destino);
    return { success: true, geradoEm: new Date().toISOString() };
  } catch {
    // Erros do navegador podem conter caminhos internos e URLs; não os expõe nem grava no log.
    console.error('Falha ao capturar o diagrama do SIBH.', { diagrama: chave });
    return { success: false, error: 'Não foi possível capturar o diagrama. Tente novamente em instantes.' };
  } finally {
    clearTimeout(cancelar);
    await navegador?.close().catch(() => {});
    await rm(/*turbopackIgnore: true*/ temporario, { force: true }).catch(() => {});
  }
}

/** Última captura gravada, ou null. */
export async function lerCaptura(chave: ChaveSumario): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    return new Uint8Array(await readFile(/*turbopackIgnore: true*/ arquivoCaptura(chave)));
  } catch {
    return null;
  }
}
