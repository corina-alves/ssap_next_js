import metas from '@/conteudo/curva-contingencia.json';
import { volumeCantareira } from '../integracoes/ana';
import { hojeSp, somarDias } from '../integracoes/comum';
import { arred } from '../integracoes/http';
import { ID_CANTAREIRA, ID_SIM, resumosPeriodo } from '../integracoes/sabesp';

/**
 * Curva de Contingência (porte de curva_contingencia.php): curvas de referência
 * do SIM e do Cantareira × volume observado no período.
 *
 * As curvas vêm de series/valores_meta_diario_{Sim,Cant}.csv do PHP, convertidas
 * para src/conteudo/curva-contingencia.json. Ao receber curvas novas, gere o
 * arquivo de novo (pares [AAAA-MM-DD, %]).
 *
 * Observado: SIM pela SABESP; Cantareira pela ANA no dia mais recente (regra da
 * Sala) e pela SABESP nos dias anteriores — o PHP também caía para a SABESP
 * quando não tinha o dia da ANA guardado.
 */

export type PontoCurva = { data: string; valor: number };
export type FonteCantareira = 'ANA' | 'SABESP';
export type Observado = { data: string; sim: number | null; cantareira: number | null };

export const CURVA = {
  sim: (metas.sim as [string, number][]).map(([data, valor]) => ({ data, valor })),
  cantareira: (metas.cantareira as [string, number][]).map(([data, valor]) => ({ data, valor })),
};

/** Período coberto pelas curvas: é o intervalo padrão da página. */
export const PERIODO_CURVA = { inicio: CURVA.sim[0]!.data, fim: CURVA.sim[CURVA.sim.length - 1]!.data };

/** No máximo 2 anos por consulta (cada dia novo é uma chamada à SABESP). */
const MAX_DIAS = 731;

export type DadosCurva = {
  inicio: string;
  fim: string;
  curvaSim: PontoCurva[];
  curvaCantareira: PontoCurva[];
  observado: Observado[];
  ultimoSim: { data: string; valor: number; curva: number | null } | null;
  ultimoCantareira: { data: string; valor: number; curva: number | null; fonte: FonteCantareira } | null;
};

export async function dadosCurva(inicio: string, fim: string): Promise<DadosCurva> {
  if (inicio > fim) [inicio, fim] = [fim, inicio];
  const hoje = hojeSp();
  const fimObs = fim > hoje ? hoje : fim;

  const datas: string[] = [];
  for (let d = inicio; d <= fimObs && datas.length < MAX_DIAS; d = somarDias(d, 1)) datas.push(d);

  const resumos = await resumosPeriodo(datas);
  const volume = (data: string, id: number) => {
    const v = resumos.get(data)?.find((s) => s.id === id)?.volumePct;
    return v == null ? null : arred(v, 2);
  };
  const observado = datas
    .map((data) => ({ data, sim: volume(data, ID_SIM), cantareira: volume(data, ID_CANTAREIRA) }))
    .filter((o) => o.sim !== null || o.cantareira !== null);

  // Dia mais recente do Cantareira: ANA (do dia ou da véspera, como no PHP), se respondeu.
  let fonte: FonteCantareira = 'SABESP';
  const ultimoObs = [...observado].reverse().find((o) => o.cantareira !== null);
  if (ultimoObs && ultimoObs.data >= somarDias(hoje, -7)) {
    const ana = await volumeCantareira(ultimoObs.data);
    if (ana.ok) {
      ultimoObs.cantareira = arred(ana.dados.volumePct, 2);
      fonte = 'ANA';
    }
  }

  const noDia = (curva: PontoCurva[], data: string) => curva.find((p) => p.data === data)?.valor ?? null;
  const ultimoSimObs = [...observado].reverse().find((o) => o.sim !== null);

  return {
    inicio,
    fim,
    curvaSim: CURVA.sim.filter((p) => p.data >= inicio && p.data <= fim),
    curvaCantareira: CURVA.cantareira.filter((p) => p.data >= inicio && p.data <= fim),
    observado,
    ultimoSim: ultimoSimObs ? { data: ultimoSimObs.data, valor: ultimoSimObs.sim!, curva: noDia(CURVA.sim, ultimoSimObs.data) } : null,
    ultimoCantareira: ultimoObs
      ? { data: ultimoObs.data, valor: ultimoObs.cantareira!, curva: noDia(CURVA.cantareira, ultimoObs.data), fonte }
      : null,
  };
}
