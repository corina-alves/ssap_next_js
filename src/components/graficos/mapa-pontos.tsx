import { classeChuva } from '@/lib/hidrologia/previsao';
import type { Contorno } from '@/lib/integracoes/ibge';
import { Dica } from './dica';
import { LegendaChuva } from './mapa-grade';

const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Pontos (ex.: centro de cada sistema produtor) sobre o contorno do Estado,
 * enquadrados numa janela em volta dos pontos. Cor = classe de chuva.
 */
export function MapaPontos({
  titulo,
  contorno,
  pontos,
  margemGraus = 0.45,
}: {
  titulo: string;
  contorno: Contorno | null;
  pontos: { nome: string; lat: number; lon: number; chuvaMm: number | null }[];
  margemGraus?: number;
}) {
  const latMin = Math.min(...pontos.map((p) => p.lat)) - margemGraus;
  const latMax = Math.max(...pontos.map((p) => p.lat)) + margemGraus;
  const lonMin = Math.min(...pontos.map((p) => p.lon)) - margemGraus;
  const lonMax = Math.max(...pontos.map((p) => p.lon)) + margemGraus;
  const k = Math.cos((((latMin + latMax) / 2) * Math.PI) / 180);
  const L = 640;
  const escala = L / ((lonMax - lonMin) * k);
  const A = Math.round((latMax - latMin) * escala);
  const x = (lon: number) => (lon - lonMin) * k * escala;
  const y = (lat: number) => (latMax - lat) * escala;
  const caminho = contorno
    ?.map((pol) => pol.map((anel) => anel.map(([lo, la], i) => `${i ? 'L' : 'M'}${x(lo).toFixed(1)},${y(la).toFixed(1)}`).join('') + 'Z').join(''))
    .join('');

  return (
    <figure className="grafico">
      <figcaption className="sr-only">{titulo}</figcaption>
      <Dica>
        <svg viewBox={`0 0 ${L} ${A}`} className="mapa mapa-pontos" role="img" aria-label={titulo}>
          <rect x={0} y={0} width={L} height={A} className="mapa-mar" />
          {caminho && <path d={caminho} className="mapa-terra" />}
          {pontos.map((p) => {
            const c = classeChuva(p.chuvaMm);
            return (
              <g key={p.nome} data-dica-valor={p.chuvaMm === null ? 'sem dado' : `${fmt(p.chuvaMm)} mm`} data-dica-rotulo={`${p.nome} · 7 dias`} tabIndex={0}>
                <circle cx={x(p.lon)} cy={y(p.lat)} r={16} className={c < 0 ? 'seq-vazio mapa-ponto' : `seq-${c} mapa-ponto`} />
                <text x={x(p.lon)} y={y(p.lat) - 22} textAnchor="middle" className="mapa-rotulo mapa-rotulo-pequeno">
                  {p.nome}
                </text>
              </g>
            );
          })}
        </svg>
      </Dica>
      <LegendaChuva />
    </figure>
  );
}
