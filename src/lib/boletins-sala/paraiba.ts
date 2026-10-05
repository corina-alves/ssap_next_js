import { mapaUgrhi, SITUACOES, situacaoRios, UGRHIS, type Situacao } from '../hidrologia/situacao-rios';
import { dataSar } from '../integracoes/ana';
import { lembrar, TTL } from '../integracoes/cache';
import { hojeSp, somarDias, ttlPorData } from '../integracoes/comum';
import { buscarJson } from '../integracoes/http';

/**
 * Dados do Boletim Diário Vale do Paraíba, UGRHI 2 (porte de
 * acesso/boletim_paraiba/dados.php e config.php):
 *   - chuva acumulada em 24 h nos pluviômetros (SIBH);
 *   - previsão de chuva 24/48/72 h nos municípios (Open-Meteo);
 *   - pontos de monitoramento fora do normal (cotas de alerta do SIBH);
 *   - reservatórios do SIN na bacia (SAR/ANA): último dia e 30 dias para os gráficos.
 * Tudo no cache das integrações (SIBH 3 min, previsão 1 h, SAR por dia).
 */

export const SALA_PARAIBA = 'vale-paraiba';
export const PERMISSAO_PARAIBA = 'criar_boletim';
const UGRHI = 2;

// Previsão de chuva: municípios paulistas da bacia, de montante para jusante.
const MUNICIPIOS = [
  { nome: 'Paraibuna', lat: -23.386, lon: -45.662 },
  { nome: 'São Luiz do Paraitinga', lat: -23.222, lon: -45.31 },
  { nome: 'Santa Branca', lat: -23.397, lon: -45.884 },
  { nome: 'Igaratá (Jaguari)', lat: -23.205, lon: -46.157 },
  { nome: 'Jacareí', lat: -23.305, lon: -45.966 },
  { nome: 'São José dos Campos', lat: -23.179, lon: -45.887 },
  { nome: 'Taubaté', lat: -23.026, lon: -45.556 },
  { nome: 'Pindamonhangaba', lat: -22.924, lon: -45.462 },
  { nome: 'Guaratinguetá', lat: -22.816, lon: -45.193 },
  { nome: 'Cunha', lat: -23.074, lon: -44.96 },
  { nome: 'Cruzeiro', lat: -22.576, lon: -44.963 },
  { nome: 'Bananal', lat: -22.684, lon: -44.322 },
];

// Reservatórios do SIN na bacia (SAR/ANA, bacia 90), pelo nome que o SAR usa.
// Grupos na ordem da tabela; o destaque (UHE Jaguari) sai em quadro próprio.
const DESTAQUE = 'JAGUARI';
const RESERVATORIOS: Record<string, Record<string, string>> = {
  'Trecho paulista': { PARAIBUNA: 'Paraibuna', 'SANTA BRANCA': 'Santa Branca', JAGUARI: 'Jaguari' },
  'Calha do Paraíba do Sul (RJ/MG)': {
    FUNIL: 'Funil', 'SANTA CECILIA': 'Santa Cecília', 'ILHA POMBOS': 'Ilha dos Pombos', SIMPLICIO: 'Simplício',
    ANTA: 'Anta', SOBRAGI: 'Sobragi', PICADA: 'Picada', 'BARRA DO BRAÚNA': 'Barra do Braúna',
  },
  'Complexo de Lajes (transposição para o Guandu)': {
    TOCOS: 'Tocos', LAJES: 'Lajes', SANTANA: 'Santana', VIGARIO: 'Vigário', FONTES: 'Fontes',
    'NILO PEÇANHA': 'Nilo Peçanha', 'PEREIRA PASSOS': 'Pereira Passos',
  },
};
// Gráficos de 30 dias (afluência, defluência e volume útil), um por reservatório.
const GRAFICOS = ['JAGUARI', 'PARAIBUNA', 'SANTA BRANCA', 'FUNIL', 'SANTA CECILIA'];
const DIAS_GRAFICO = 30;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null; // "-" = sem volume útil (fio d'água)
};

// ---------------------------------------------------------------- SAR/ANA

type ValoresSin = { afluencia: number | null; defluencia: number | null; cota: number | null; volume: number | null };

/** Reservatórios do SIN de um dia: NOME → valores. Dia sem medição não é guardado (tenta de novo depois). */
async function sinDoDia(ymd: string, bacia: number): Promise<Record<string, ValoresSin> | null> {
  const url = `https://www.ana.gov.br/sar/restportal/api/retornaMedicoesSIN?data=${encodeURIComponent(dataSar(ymd))}&tipoSistema=2&bacia=${bacia}`;
  const l = await lembrar('ana', `sin-valores:${bacia}:${ymd}`, ttlPorData(ymd, TTL.hora, TTL.historico), async () => {
    const json = await buscarJson(url, { timeoutMs: 15_000 });
    if (!Array.isArray(json) || !json.length) return null;
    const dia: Record<string, ValoresSin> = {};
    for (const r of json as Record<string, unknown>[]) {
      const nome = String(r.reservatorio ?? '').trim().toUpperCase();
      if (nome) dia[nome] = { afluencia: num(r.afluencia), defluencia: num(r.defluencia), cota: num(r.cota), volume: num(r.volumeUtil) };
    }
    return dia;
  }, { esperaFalhaSeg: 10 * 60 });
  return l?.valor ?? null;
}

// ---------------------------------------------------------------- Open-Meteo

type PrevisaoPonto = { nome: string; lat: number; lon: number; h24: number | null; h48: number | null; h72: number | null; prob: number | null };

const fmtHoraSp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
/** "2026-10-05 10:35" no horário de São Paulo. */
const agoraSp = (d = new Date()) => fmtHoraSp.format(d);

/**
 * Chuva prevista nas próximas 24, 48 e 72 h (a partir da hora atual) para os
 * municípios, numa única chamada em lote. h48 = entre 24 e 48 h; h72 = entre
 * 48 e 72 h; prob = probabilidade máxima nas 24 h.
 */
async function previsaoMunicipios(): Promise<PrevisaoPonto[]> {
  const hora = `${agoraSp().slice(0, 13).replace(' ', 'T')}:00`;
  const l = await lembrar('previsao', `paraiba-horaria:${hora}`, TTL.hora, async () => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${MUNICIPIOS.map((p) => p.lat).join(',')}&longitude=${MUNICIPIOS.map((p) => p.lon).join(',')}` +
      '&hourly=precipitation,precipitation_probability&forecast_days=4&timezone=America%2FSao_Paulo';
    const r = await buscarJson(url, { timeoutMs: 20_000 });
    const lista = Array.isArray(r) ? r : [r];
    return lista.map((p) => ((p as { hourly?: Record<string, unknown[]> }).hourly ?? {}) as Record<string, unknown[]>);
  });
  const dados = l?.valor ?? [];
  return MUNICIPIOS.map((p, i) => {
    const h = dados[i] ?? {};
    const inicio = (h.time ?? []).indexOf(hora);
    const soma = (de: number, ate: number) => {
      if (inicio < 0) return null;
      const v = (h.precipitation ?? []).slice(inicio + de, inicio + ate);
      return v.length === ate - de ? Math.round(v.reduce<number>((t, x) => t + (Number(x) || 0), 0) * 10) / 10 : null;
    };
    const probs = inicio < 0 ? [] : (h.precipitation_probability ?? []).slice(inicio, inicio + 24).filter((x): x is number => typeof x === 'number');
    return { ...p, h24: soma(0, 24), h48: soma(24, 48), h72: soma(48, 72), prob: probs.length ? Math.max(...probs) : null };
  });
}

// ---------------------------------------------------------------- boletim

export async function dadosParaiba(atualizar = false) {
  const falhas: string[] = [];

  const hoje = hojeSp();
  const datas = Array.from({ length: DIAS_GRAFICO + 1 }, (_, i) => somarDias(hoje, i - DIAS_GRAFICO));

  const [situacao, mapa, previsao, dias] = await Promise.all([
    situacaoRios(atualizar),
    mapaUgrhi(UGRHI, 24),
    previsaoMunicipios().catch(() => [] as PrevisaoPonto[]),
    Promise.all(datas.map((d) => sinDoDia(d, 90).catch(() => null))),
  ]);

  // ---- Chuva observada (24 h) e pontos de monitoramento
  falhas.push(...situacao.falhas, ...mapa.falhas);
  const postos = mapa.chuva_todos;
  const valores = postos.map((p) => p.v);
  const pontos = situacao.postos.filter((p) => p.ugrhi === UGRHI);
  const contagem = Object.fromEntries(Object.keys(SITUACOES).map((k) => [k, 0])) as Record<Situacao, number>;
  for (const p of pontos) contagem[p.situacao]++;

  // ---- Previsão
  if (!previsao.some((p) => p.h24 !== null)) falhas.push('previsão de chuva (Open-Meteo)');

  // ---- Reservatórios (SAR/ANA): últimos N dias + hoje
  const sar = new Map<string, Record<string, ValoresSin>>();
  datas.forEach((d, i) => dias[i] && sar.set(d, dias[i]!));
  if (!sar.size) falhas.push('reservatórios (SAR/ANA)');
  const ultimaData = [...sar.keys()].pop() ?? null;
  const ultimo = ultimaData ? sar.get(ultimaData)! : {};
  const semanaAntes = ultimaData ? (sar.get(somarDias(ultimaData, -7)) ?? {}) : {};

  const nomes: Record<string, string> = Object.assign({}, ...Object.values(RESERVATORIOS));
  const lista = Object.entries(RESERVATORIOS).flatMap(([grupo, itens]) =>
    Object.entries(itens).map(([chave, nome]) => {
      const r = ultimo[chave];
      const ant = semanaAntes[chave];
      return {
        chave, nome, grupo,
        afluencia: r?.afluencia ?? null, defluencia: r?.defluencia ?? null, cota: r?.cota ?? null, volume: r?.volume ?? null,
        volume_7d: ant?.volume ?? null, cota_7d: ant?.cota ?? null,
      };
    }),
  );
  const series = GRAFICOS.map((chave) => {
    const diasSerie = [...sar.entries()];
    return {
      chave,
      nome: nomes[chave] ?? chave,
      datas: diasSerie.map(([d]) => d),
      afluencia: diasSerie.map(([, dia]) => dia[chave]?.afluencia ?? null),
      defluencia: diasSerie.map(([, dia]) => dia[chave]?.defluencia ?? null),
      volume: diasSerie.map(([, dia]) => dia[chave]?.volume ?? null),
    };
  });

  return {
    gerado_em: agoraSp(),
    sibh_em: agoraSp(new Date(situacao.gerado_em * 1000)),
    ugrhi: { codigo: UGRHI, nome: UGRHIS[UGRHI] },
    chuva: {
      horas: 24,
      postos,
      total_postos: postos.length,
      media: valores.length ? Math.round((valores.reduce((t, v) => t + v, 0) / valores.length) * 10) / 10 : null,
      maxima: postos[0] ?? null,
      acima: { 10: valores.filter((v) => v > 10).length, 25: valores.filter((v) => v > 25).length, 50: valores.filter((v) => v > 50).length },
    },
    previsao,
    pontos: { contagem, total: pontos.length, fora: pontos.filter((p) => p.situacao !== 'normal'), situacoes: SITUACOES },
    reservatorios: { data: ultimaData, destaque: DESTAQUE, lista, series },
    falhas: [...new Set(falhas)],
  };
}
